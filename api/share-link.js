// =====================================================================
// K9 — /api/share-link  (lien lecture seule véto/pension, TTL 24h)
// =====================================================================
// POST /api/share-link          → crée un token pour le chien actif
//   body: { dogId, scope: "health"|"full", hours: 24 }
//   returns: { url, token, expiresAt }
// GET  /api/share-link?token=…  → renvoie le snapshot public lecture seule
//   (pas d'auth requise — le token EST l'auth)
// =====================================================================

import { supabaseEnabled, createAdminClient, getUser, preflight, readBody, json, err, mockResponse } from "./_lib/supabase.js";

function genToken() {
  // Pas de dépendance : 22 chars base62 from crypto
  const crypto = require("crypto");
  return crypto.randomBytes(18).toString("base64url");
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!supabaseEnabled) return mockResponse(res);

  const admin = createAdminClient();

  try {
    if (req.method === "POST") {
      const user = await getUser(req);
      if (!user) return err(res, 401, "Auth required");
      const body = await readBody(req);
      const { dogId, scope = "health", hours = 24 } = body || {};
      if (!dogId) return err(res, 400, "dogId required");

      // Vérifier ownership du chien
      const { data: dog } = await admin.from("dogs").select("id").eq("id", dogId).eq("user_id", user.id).maybeSingle();
      if (!dog) return err(res, 404, "Dog not found or not yours");

      const token = genToken();
      const expiresAt = new Date(Date.now() + Math.max(1, Math.min(hours, 168)) * 3600 * 1000).toISOString();

      const { error } = await admin.from("share_tokens").insert({
        token, user_id: user.id, dog_id: dogId, scope, expires_at: expiresAt,
      });
      if (error) return err(res, 500, error.message);

      await admin.from("audit_logs").insert({
        user_id: user.id, action: "share.created",
        payload: { dogId, scope, expiresAt },
        ip: req.headers["x-forwarded-for"] || null,
        ua: req.headers["user-agent"] || null,
      });

      const baseUrl = process.env.PUBLIC_APP_URL || "https://k9-one.vercel.app";
      return json(res, 200, {
        token,
        expiresAt,
        url: `${baseUrl}/?share=${token}`,
      });
    }

    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host || "x"}`);
      const token = url.searchParams.get("token");
      if (!token) return err(res, 400, "token required");

      const { data: tok } = await admin.from("share_tokens").select("*").eq("token", token).maybeSingle();
      if (!tok) return err(res, 404, "Invalid token");
      if (new Date(tok.expires_at) < new Date()) return err(res, 410, "Expired");

      const [dog, events] = await Promise.all([
        admin.from("dogs").select("*").eq("id", tok.dog_id).maybeSingle(),
        admin.from("calendar_events").select("*").eq("dog_id", tok.dog_id).order("event_date"),
      ]);
      if (!dog.data) return err(res, 404, "Dog not found");

      // Log access
      await admin.from("share_tokens").update({
        last_accessed_at: new Date().toISOString(),
        access_count: (tok.access_count || 0) + 1,
      }).eq("token", token);
      await admin.from("audit_logs").insert({
        user_id: tok.user_id, action: "share.accessed",
        payload: { token: token.slice(0, 6) + "…", dogId: tok.dog_id },
        ip: req.headers["x-forwarded-for"] || null,
        ua: req.headers["user-agent"] || null,
      });

      return json(res, 200, {
        dog: {
          name: dog.data.name,
          breedIdx: dog.data.breed_idx,
          years: dog.data.years,
          months: dog.data.months,
          weight: dog.data.weight_kg,
          sex: dog.data.sex,
          emoji: dog.data.emoji,
          photo: dog.data.photo_url || dog.data.photo_data_url,
          chipId: dog.data.chip_id,
          birthday: dog.data.birthday,
          vet: {
            name: dog.data.vet_name,
            phone: dog.data.vet_phone,
            address: dog.data.vet_address,
          },
        },
        events: (events.data || []).map((ev) => ({
          type: ev.type, title: ev.title, date: ev.event_date, notes: ev.notes,
        })),
        scope: tok.scope,
        expiresAt: tok.expires_at,
      });
    }

    return err(res, 405, "Method not allowed");
  } catch (e) {
    console.error("share-link handler error:", e);
    return err(res, 500, "Server error", String(e?.message || e));
  }
}
