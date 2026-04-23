// =====================================================================
// K9 — /api/alerts  (lost/found dog alerts)
// =====================================================================
// GET    /api/alerts?lat=&lon=&radius=  → liste publique (nearby)
// GET    /api/alerts?mine=1             → les miennes (auth requise)
// POST   /api/alerts                    → create (auth requise)
// PATCH  /api/alerts?id=…               → mark resolved (auth requise)
// DELETE /api/alerts?id=…               → delete (auth requise)
//
// Photos : le client envoie un base64 dataURL. Si Supabase Storage est
// activé, on upload dans le bucket `alert-photos` et on stocke l'URL.
// Sinon on garde le base64 en colonne (compat v1).
// =====================================================================

import { supabaseEnabled, createAdminClient, getUser, preflight, readBody, json, err, mockResponse } from "./_lib/supabase.js";

const BUCKET = "alert-photos";

async function uploadPhoto(admin, userId, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
  try {
    const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const ext = mime.split("/")[1] || "png";
    const buf = Buffer.from(match[2], "base64");
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    });
    if (error) return null;
    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!supabaseEnabled) return mockResponse(res, { alerts: [] });

  const admin = createAdminClient();

  try {
    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host || "x"}`);
      const mine = url.searchParams.get("mine");

      if (mine === "1") {
        const user = await getUser(req);
        if (!user) return err(res, 401, "Auth required");
        const { data, error } = await admin
          .from("lost_found_alerts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) return err(res, 500, error.message);
        return json(res, 200, { alerts: data || [] });
      }

      const lat = parseFloat(url.searchParams.get("lat"));
      const lon = parseFloat(url.searchParams.get("lon"));
      const radius = parseFloat(url.searchParams.get("radius")) || 30;
      const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);

      const { data, error } = hasGeo
        ? await admin.rpc("alerts_nearby", { p_lat: lat, p_lon: lon, p_radius_km: radius, p_limit: 50 })
        : await admin.from("lost_found_alerts").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(50);
      if (error) return err(res, 500, error.message);
      return json(res, 200, { alerts: data || [] });
    }

    if (req.method === "POST") {
      const user = await getUser(req);
      if (!user) return err(res, 401, "Auth required");
      const body = await readBody(req);
      const { type, dogName, breed, photo, place, geoLat, geoLon, description, contact } = body || {};

      if (!type || !["lost", "found"].includes(type)) return err(res, 400, "Invalid type");
      if (!place) return err(res, 400, "Place required");
      if (!contact) return err(res, 400, "Contact required");

      let photoUrl = null;
      let photoDataUrl = null;
      if (photo) {
        photoUrl = await uploadPhoto(admin, user.id, photo);
        if (!photoUrl) photoDataUrl = photo; // fallback
      }

      const { data, error } = await admin.from("lost_found_alerts").insert({
        user_id: user.id,
        type,
        dog_name: dogName || null,
        breed: breed || null,
        photo_url: photoUrl,
        photo_data_url: photoDataUrl,
        place,
        geo_lat: geoLat || null,
        geo_lon: geoLon || null,
        description: description || null,
        contact,
      }).select().maybeSingle();

      if (error) return err(res, 500, error.message);
      return json(res, 200, { alert: data });
    }

    if (req.method === "PATCH") {
      const user = await getUser(req);
      if (!user) return err(res, 401, "Auth required");
      const url = new URL(req.url, `http://${req.headers.host || "x"}`);
      const id = url.searchParams.get("id");
      if (!id) return err(res, 400, "id required");
      const body = await readBody(req);
      const patch = {};
      if (typeof body.resolved === "boolean") {
        patch.resolved = body.resolved;
        patch.resolved_at = body.resolved ? new Date().toISOString() : null;
      }
      const { data, error } = await admin.from("lost_found_alerts")
        .update(patch).eq("id", id).eq("user_id", user.id).select().maybeSingle();
      if (error) return err(res, 500, error.message);
      return json(res, 200, { alert: data });
    }

    if (req.method === "DELETE") {
      const user = await getUser(req);
      if (!user) return err(res, 401, "Auth required");
      const url = new URL(req.url, `http://${req.headers.host || "x"}`);
      const id = url.searchParams.get("id");
      if (!id) return err(res, 400, "id required");
      const { error } = await admin.from("lost_found_alerts")
        .delete().eq("id", id).eq("user_id", user.id);
      if (error) return err(res, 500, error.message);
      return json(res, 200, { ok: true });
    }

    return err(res, 405, "Method not allowed");
  } catch (e) {
    console.error("alerts handler error:", e);
    return err(res, 500, "Server error", String(e?.message || e));
  }
}
