// =====================================================================
// K9 — /api/me  (profil courant + config publique)
// =====================================================================
// GET  /api/me                  → { user, profile, config }
// POST /api/me                  → upsert partiel du profil (name, approx_city, geo_lat, geo_lon)
//
// Auth requise. Renvoie 200 {mock:true} si Supabase n'est pas branché
// pour que le client détecte proprement l'indisponibilité.
// =====================================================================

import { supabaseEnabled, createAdminClient, getUser, preflight, readBody, json, err, mockResponse } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!supabaseEnabled) return mockResponse(res);

  const user = await getUser(req);
  if (!user) return err(res, 401, "Auth required");
  const admin = createAdminClient();

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
