// =====================================================================
// K9 — /api/alerts  (lost/found dog alerts + AI reverse search)
// =====================================================================
// GET    /api/alerts?lat=&lon=&radius=     → liste publique (nearby)
// GET    /api/alerts?mine=1                → les miennes (auth requise)
// GET    /api/alerts?action=match&id=…     → AI reverse-search (v3.3)
// POST   /api/alerts                       → create (auth requise)
// PATCH  /api/alerts?id=…                  → mark resolved (auth requise)
// DELETE /api/alerts?id=…                  → delete (auth requise)
//
// Photos : le client envoie un base64 dataURL. Si Supabase Storage est
// activé, on upload dans le bucket `alert-photos` et on stocke l'URL.
// Sinon on garde le base64 en colonne (compat v1).
// =====================================================================

import { supabaseEnabled, createAdminClient, getUser, preflight, readBody, json, err, mockResponse, BUCKETS } from "./_lib/supabase.js";

const BUCKET = BUCKETS.ALERT_PHOTOS;

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

// ============== AI Reverse Search (v3.3) ==============
// Compare la photo d'un signalement (généralement type=found) avec les autres
// alertes opposées (type=lost) géographiquement proches via Claude Vision.

async function _fetchPhotoBase64(url) {
  // Si l'URL est déjà un dataURL, on l'utilise tel quel
  if (url && url.startsWith("data:image/")) {
    const m = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
    return m ? { mediaType: m[1], data: m[2] } : null;
  }
  // Sinon on fetch et on convertit
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await r.arrayBuffer());
    // Limite à 4 MB après upload (Claude limit ~5 MB par image, on garde marge)
    if (buf.length > 4 * 1024 * 1024) return null;
    return { mediaType: ct, data: buf.toString("base64") };
  } catch {
    return null;
  }
}

async function _compareTwoDogs(apiKey, foundPhoto, lostPhoto, lang) {
  const promptFr = `Tu compares deux photos de chien. La 1ère vient d'un chien TROUVÉ par un passant. La 2ème vient d'un chien PERDU signalé par son propriétaire.

Évalue la probabilité que ce soit le MÊME chien sur une échelle 0-100, en tenant compte de :
- Race (forme du museau, oreilles, taille apparente)
- Couleur du pelage (motif, distribution des couleurs)
- Marques distinctives (taches, médaillon blanc, cicatrices)
- Morphologie générale

Réponds STRICTEMENT en JSON :
{ "score": <0-100>, "reasoning": "<courte phrase expliquant>" }

- score >= 75 : très probable que ce soit le même chien
- 50-74 : possible (race et couleur compatibles, à vérifier)
- 25-49 : peu probable (quelques traits communs)
- < 25 : différent (race ou couleur très différentes)

Ne réponds RIEN d'autre que le JSON.`;

  const promptEn = `You compare two dog photos. The 1st is a FOUND dog photographed by a passerby. The 2nd is a LOST dog reported by its owner.

Rate the probability they are the SAME dog on a 0-100 scale, considering:
- Breed (muzzle, ears, apparent size)
- Coat color (pattern, color distribution)
- Distinctive marks (spots, white markings, scars)
- General morphology

Reply STRICTLY in JSON:
{ "score": <0-100>, "reasoning": "<short explanation>" }

- 75+ = highly likely same dog
- 50-74 = possible (compatible breed/color, worth checking)
- 25-49 = unlikely (some shared traits)
- <25 = different (very different breed/color)

Reply with JSON only.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: lang === "en" ? promptEn : promptFr,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: lang === "en" ? "Photo 1 (FOUND):" : "Photo 1 (TROUVÉ) :" },
          { type: "image", source: { type: "base64", media_type: foundPhoto.mediaType, data: foundPhoto.data } },
          { type: "text", text: lang === "en" ? "Photo 2 (LOST):" : "Photo 2 (PERDU) :" },
          { type: "image", source: { type: "base64", media_type: lostPhoto.mediaType, data: lostPhoto.data } },
        ],
      }],
    }),
  });
  if (!resp.ok) {
    return { score: 0, reasoning: "AI error", error: true };
  }
  const data = await resp.json();
  const raw = data?.content?.[0]?.text || "{}";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      score: Math.max(0, Math.min(100, parseInt(parsed.score, 10) || 0)),
      reasoning: String(parsed.reasoning || "").slice(0, 200),
    };
  } catch {
    return { score: 0, reasoning: "Parse error" };
  }
}

async function findMatches(admin, user, alertId, lang = "fr") {
  // 1. Récupère l'alerte source
  const { data: src, error } = await admin
    .from("lost_found_alerts")
    .select("*")
    .eq("id", alertId)
    .maybeSingle();
  if (error || !src) return { error: "alert_not_found" };
  // Le matching est public (pas de check user_id) — n'importe qui peut chercher
  // mais seulement pour ses propres alerts (sinon on retourne 403)
  if (src.user_id !== user.id) return { error: "forbidden" };
  if (!src.photo_url && !src.photo_data_url) return { error: "no_photo" };

  // 2. Cherche les alertes opposées (lost si src=found, found si src=lost)
  const oppositeType = src.type === "lost" ? "found" : "lost";
  // Géographique si possible, sinon globalement (limite 10)
  let candidates = [];
  if (src.geo_lat && src.geo_lon) {
    const { data } = await admin.rpc("alerts_nearby", {
      p_lat: src.geo_lat, p_lon: src.geo_lon, p_radius_km: 50, p_limit: 15
    });
    candidates = (data || []).filter(a => a.type === oppositeType && a.id !== src.id && !a.resolved);
  } else {
    const { data } = await admin
      .from("lost_found_alerts")
      .select("*")
      .eq("type", oppositeType)
      .eq("resolved", false)
      .neq("id", src.id)
      .order("created_at", { ascending: false })
      .limit(10);
    candidates = data || [];
  }
  // Filtre les candidats avec photo et pas trop vieux (60 jours)
  const cutoff = Date.now() - 60 * 24 * 3600 * 1000;
  candidates = candidates
    .filter(c => (c.photo_url || c.photo_data_url) && new Date(c.created_at).getTime() > cutoff)
    .slice(0, 8);

  if (candidates.length === 0) {
    return { matches: [], message: "no_candidates" };
  }

  // 3. Récupère le photo source en base64
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { matches: [], message: "ai_not_configured" };
  }
  const srcPhotoB64 = await _fetchPhotoBase64(src.photo_url || src.photo_data_url);
  if (!srcPhotoB64) return { error: "source_photo_load_failed" };

  // 4. Compare avec chaque candidat (séquentiel pour rester sympa avec l'API)
  const matches = [];
  for (const cand of candidates) {
    const candPhoto = await _fetchPhotoBase64(cand.photo_url || cand.photo_data_url);
    if (!candPhoto) continue;
    // src est found → photo source = found ; cand est lost → cand photo = lost
    const foundPhoto = src.type === "found" ? srcPhotoB64 : candPhoto;
    const lostPhoto  = src.type === "lost"  ? srcPhotoB64 : candPhoto;
    const cmp = await _compareTwoDogs(apiKey, foundPhoto, lostPhoto, lang);
    if (cmp.score >= 30) {
      matches.push({
        alertId: cand.id,
        type: cand.type,
        dogName: cand.dog_name,
        breed: cand.breed,
        place: cand.place,
        photoUrl: cand.photo_url || cand.photo_data_url,
        contact: cand.contact,
        score: cmp.score,
        reasoning: cmp.reasoning,
        createdAt: cand.created_at,
      });
    }
  }
  // Trie par score décroissant
  matches.sort((a, b) => b.score - a.score);
  return { matches, totalCompared: candidates.length };
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!supabaseEnabled) return mockResponse(res, { alerts: [] });

  const admin = createAdminClient();

  try {
    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host || "x"}`);
      const mine = url.searchParams.get("mine");
      const action = url.searchParams.get("action");

      // ---- AI reverse search (v3.3) ----
      if (action === "match") {
        const user = await getUser(req);
        if (!user) return err(res, 401, "Auth required");
        const id = url.searchParams.get("id");
        if (!id) return err(res, 400, "id required");
        const lang = url.searchParams.get("lang") || "fr";
        const result = await findMatches(admin, user, id, lang);
        if (result.error) return err(res, result.error === "forbidden" ? 403 : 400, result.error);
        return json(res, 200, result);
      }

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
