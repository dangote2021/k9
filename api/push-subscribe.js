// =====================================================================
// K9 — /api/push-subscribe  (Web Push : enregistrer un endpoint)
// =====================================================================
// POST   /api/push-subscribe   → enregistre l'endpoint + keys
// DELETE /api/push-subscribe   → désabonne
//
// Le frontend passe ici la PushSubscription JSON fournie par le navigateur
// après `registration.pushManager.subscribe({userVisibleOnly, applicationServerKey})`.
// =====================================================================

import { supabaseEnabled, createAdminClient, getUser, preflight, readBody, json, err, mockResponse } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!supabaseEnabled) return mockResponse(res);

  const user = await getUser(req);
  if (!user) return err(res, 401, "Auth required");
  const admin = createAdminClient();

  if (req.method === "POST") {
    const body = await readBody(req);
    const { endpoint, keys, userAgent } = body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return err(res, 400, "Invalid subscription payload");
    }
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
