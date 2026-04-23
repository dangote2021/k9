// =====================================================================
// K9 — /api/feed  (community posts feed)
// =====================================================================
// GET  /api/feed?lat=&lon=&radius=  → posts récents (globaux + proches)
// POST /api/feed                    → créer un post (auth)
//   body: { text, photo (dataURL), place, geoLat, geoLon, dogId }
// =====================================================================

import { supabaseEnabled, createAdminClient, getUser, preflight, readBody, json, err, mockResponse } from "./_lib/supabase.js";

const BUCKET = "post-photos";

async function uploadPhoto(admin, userId, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const ext = (match[1].split("/")[1] || "png").replace("jpeg", "jpg");
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(match[2], "base64");
    const { error } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: match[1], upsert: false,
    });
    if (error) return null;
    return admin.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl || null;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!supabaseEnabled) return mockResponse(res, { posts: [] });

  const admin = createAdminClient();

  try {
    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host || "x"}`);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10), 100);
      // Posts joints à profile (author name) + dog (name, emoji)
      const { data, error } = await admin
        .from("posts")
        .select(`id, text, photo_url, place, created_at, dog_id, user_id,
                 profiles:user_id(name),
                 dogs:dog_id(name, emoji)`)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return err(res, 500, error.message);
      const posts = (data || []).map((p) => ({
        id: p.id,
        text: p.text,
        photo: p.photo_url,
        place: p.place,
        createdAt: p.created_at,
        author: p.profiles?.name || "Un propriétaire",
        dogName: p.dogs?.name || null,
        dogEmoji: p.dogs?.emoji || "🐕",
      }));
      return json(res, 200, { posts });
    }

    if (req.method === "POST") {
      const user = await getUser(req);
      if (!user) return err(res, 401, "Auth required");
      const body = await readBody(req);
      const { text, photo, place, geoLat, geoLon, dogId } = body || {};
      if (!text && !photo) return err(res, 400, "text or photo required");

      const photoUrl = photo ? await uploadPhoto(admin, user.id, photo) : null;
      const { data, error } = await admin.from("posts").insert({
        user_id: user.id,
        dog_id: dogId || null,
        text: text || null,
        photo_url: photoUrl,
        place: place || null,
        geo_lat: geoLat || null,
        geo_lon: geoLon || null,
      }).select().maybeSingle();
      if (error) return err(res, 500, error.message);
      return json(res, 200, { post: data });
    }

    return err(res, 405, "Method not allowed");
  } catch (e) {
    console.error("feed handler error:", e);
    return err(res, 500, "Server error", String(e?.message || e));
  }
}
