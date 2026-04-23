// =====================================================================
// K9 — /api/me  (dispatcher : profil, config publique, quotas IA, push, plan Stripe)
// =====================================================================
// Un seul endpoint pour limiter le nombre de fonctions serverless
// (Hobby Vercel = 12 max). Les URLs historiques sont rewrite vers ici
// (voir vercel.json).
//
// Routes gérées :
//   GET  /api/me?public=1                → config publique (pas d'auth)
//                                           { supabaseUrl, supabaseAnonKey,
//                                             vapidPublicKey, publicAppUrl,
//                                             cloudEnabled }
//   GET  /api/me                         → { user, profile, config }            [auth]
//   POST /api/me                         → upsert profil                         [auth]
//   GET  /api/me?action=quotas           → { plan, usedToday, limit, remaining } [auth]
//   POST /api/me?action=quotas           → incrément atomique (RPC)              [auth]
//   POST /api/me?action=push-subscribe   → enregistre endpoint Web Push          [auth]
//   DELETE /api/me?action=push-subscribe → désabonne                              [auth]
//   GET  /api/me?action=plan-status&sid= → vérifie Checkout Session Stripe       [public]
// =====================================================================

import {
  supabaseEnabled, createAdminClient, getUser,
  applyCors, preflight, readBody, json, err, mockResponse,
} from "./_lib/supabase.js";

const FREE_DAILY = 3;

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  applyCors(res);

  const q = req.query || {};
  const action = (q.action || "").toString();
  const isPublic = q.public === "1" || q.public === "true";

  // --- 1. Config publique (non authentifiée) ---
  if (req.method === "GET" && isPublic) {
    const supabaseUrl = process.env.SUPABASE_URL || null;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || null;
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || null;
    const publicAppUrl = process.env.PUBLIC_APP_URL || null;
    const cloudEnabled = !!(supabaseUrl && supabaseAnonKey);
    return json(res, 200, { supabaseUrl, supabaseAnonKey, vapidPublicKey, publicAppUrl, cloudEnabled });
  }

  // --- 2. Plan status (public, après redirection Stripe Checkout) ---
  if (action === "plan-status") {
    if (req.method !== "GET") return err(res, 405, "Method not allowed");
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return json(res, 200, { ok: false, reason: "stripe-not-configured" });
    const sid = (q.sid || "").toString();
    if (!sid) return err(res, 400, "Missing sid");
    try {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(secretKey, { apiVersion: "2024-11-20.acacia" });
      const s = await stripe.checkout.sessions.retrieve(sid, { expand: ["subscription"] });
      const paid = s.payment_status === "paid" || s.status === "complete";
      const plan = s.metadata?.plan || "free";
      return json(res, 200, {
        ok: paid, plan,
        email: s.customer_email || s.customer_details?.email || null,
        subscriptionId: typeof s.subscription === "string" ? s.subscription : s.subscription?.id,
      });
    } catch (e) {
      console.error("plan-status error:", e);
      return err(res, 500, "Lookup failed");
    }
  }

  // --- Reste : authentifié + Supabase requis ---
  if (!supabaseEnabled) return mockResponse(res);

  const user = await getUser(req);
  if (!user) return err(res, 401, "Auth required");
  const admin = createAdminClient();

  // --- 3. Quotas IA ---
  if (action === "quotas") {
    const today = new Date().toISOString().slice(0, 10);
    const { data: profile } = await admin.from("profiles").select("plan").eq("user_id", user.id).maybeSingle();
    const { data: row } = await admin.from("ai_quotas").select("count").eq("user_id", user.id).eq("day", today).maybeSingle();
    const plan = profile?.plan || "free";
    const usedToday = row?.count || 0;
    const limit = plan === "free" ? FREE_DAILY : null;
    const remaining = plan === "free" ? Math.max(0, FREE_DAILY - usedToday) : 999;

    if (req.method === "GET") return json(res, 200, { plan, usedToday, limit, remaining });
    if (req.method === "POST") {
      const { data, error } = await admin.rpc("ai_quota_increment", { p_limit: FREE_DAILY });
      if (error) return err(res, 500, error.message);
      const r = Array.isArray(data) ? data[0] : data;
      return json(res, 200, { allowed: !!r?.allowed, countAfter: r?.count_after || 0, plan });
    }
    return err(res, 405, "Method not allowed");
  }

  // --- 4. Push subscribe / unsubscribe ---
  if (action === "push-subscribe") {
    if (req.method === "POST") {
      const body = await readBody(req);
      const { endpoint, keys, userAgent } = body || {};
      if (!endpoint || !keys?.p256dh || !keys?.auth) return err(res, 400, "Invalid subscription payload");
      const { error } = await admin.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent || null,
      }, { onConflict: "user_id,endpoint" });
      if (error) return err(res, 500, error.message);
      return json(res, 200, { ok: true });
    }
    if (req.method === "DELETE") {
      const body = await readBody(req);
      const { endpoint } = body || {};
      if (!endpoint) return err(res, 400, "endpoint required");
      const { error } = await admin.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
      if (error) return err(res, 500, error.message);
      return json(res, 200, { ok: true });
    }
    return err(res, 405, "Method not allowed");
  }

  // --- 5. Profil (défaut) ---
  if (req.method === "GET") {
    const { data: profile } = await admin.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    return json(res, 200, {
      user: { id: user.id, email: user.email },
      profile: profile || null,
      config: {
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
        publicAppUrl: process.env.PUBLIC_APP_URL || "https://k9-one.vercel.app",
      },
    });
  }

  if (req.method === "POST" || req.method === "PATCH") {
    const body = await readBody(req);
    const patch = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.approxCity === "string") patch.approx_city = body.approxCity;
    if (typeof body.geoLat === "number") patch.geo_lat = body.geoLat;
    if (typeof body.geoLon === "number") patch.geo_lon = body.geoLon;
    if (typeof body.lang === "string") patch.lang = body.lang;
    if (!Object.keys(patch).length) return err(res, 400, "Nothing to update");
    const { data, error } = await admin.from("profiles").upsert({
      user_id: user.id, email: user.email, ...patch,
    }, { onConflict: "user_id" }).select().maybeSingle();
    if (error) return err(res, 500, error.message);
    return json(res, 200, { profile: data });
  }

  return err(res, 405, "Method not allowed");
}
