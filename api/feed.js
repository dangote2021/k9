// =====================================================================
// K9 — /api/feed  (community posts feed + friends + playdates)
// =====================================================================
// Endpoints multiplexés via ?action= pour rester ≤ 12 lambdas Hobby.
//
// === Posts (community feed) ===
// GET  /api/feed?lat=&lon=&radius=  → posts récents
// POST /api/feed                    → créer un post (auth)
//   body: { text, photo (dataURL), place, geoLat, geoLon, dogId }
//
// === Friends (v3.2) ===
// GET    /api/feed?action=friends                 → list mes amis
// POST   /api/feed?action=friend-request          → invite par email
//   body: { email }
// POST   /api/feed?action=friend-accept           → accepter une demande
//   body: { friendId }
// DELETE /api/feed?action=friend                  → retirer ami / refuser
//   body: { friendId }
//
// === Playdates (v3.2) ===
// GET    /api/feed?action=playdates&upcoming=1    → mes playdates à venir
// POST   /api/feed?action=playdate-create
//   body: { place, scheduledAt, geoLat, geoLon, notes, maxDogs, dogId }
// POST   /api/feed?action=playdate-join
//   body: { playdateId, dogId }
// DELETE /api/feed?action=playdate-leave
//   body: { playdateId }
// DELETE /api/feed?action=playdate-cancel         (host only)
//   body: { playdateId }
// =====================================================================

import { supabaseEnabled, createAdminClient, getUser, preflight, readBody, json, err, mockResponse, BUCKETS } from "./_lib/supabase.js";

const BUCKET = BUCKETS.POST_PHOTOS;

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

// ======================== FRIENDS ========================

async function listFriends(admin, userId) {
  // Renvoie les amis acceptés + les invitations en attente reçues
  const { data: rows, error } = await admin
    .from("friendships")
    .select("user_id, friend_id, status, created_at")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  // Récupère les profils des "autres" users
  const otherIds = [...new Set((rows || []).map(r =>
    r.user_id === userId ? r.friend_id : r.user_id
  ))];
  if (otherIds.length === 0) return { accepted: [], pendingIn: [], pendingOut: [] };
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, email, avatar_url")
    .in("id", otherIds);
  const profMap = new Map((profiles || []).map(p => [p.id, p]));
  const accepted = [];
  const pendingIn = [];   // m'a invité, j'ai pas encore accepté
  const pendingOut = [];  // j'ai invité quelqu'un
  for (const r of (rows || [])) {
    const otherId = r.user_id === userId ? r.friend_id : r.user_id;
    const prof = profMap.get(otherId);
    const entry = {
      id: otherId,
      name: prof?.name || "Anonyme",
      email: prof?.email || null,
      avatar: prof?.avatar_url || null,
      since: r.created_at,
    };
    if (r.status === "accepted") accepted.push(entry);
    else if (r.status === "pending") {
      if (r.user_id === userId) pendingOut.push(entry);
      else pendingIn.push(entry);
    }
  }
  return { accepted, pendingIn, pendingOut };
}

async function sendFriendRequest(admin, userId, email) {
  if (!email || typeof email !== "string") return { error: "email required" };
  // Trouve l'user par email via profiles
  const { data: target } = await admin
    .from("profiles")
    .select("id, name, email")
    .ilike("email", email.trim())
    .maybeSingle();
  if (!target) return { error: "no_user", message: "Aucun compte K9 avec cet email" };
  if (target.id === userId) return { error: "self", message: "Tu ne peux pas t'ajouter toi-même" };
  // Insère friendship pending (idempotent : on ignore si existe déjà)
  const { error } = await admin
    .from("friendships")
    .upsert({
      user_id: userId,
      friend_id: target.id,
      status: "pending",
    }, { onConflict: "user_id,friend_id" });
  if (error) return { error: error.message };
  return { ok: true, friend: { id: target.id, name: target.name, email: target.email } };
}

async function acceptFriendRequest(admin, userId, friendId) {
  if (!friendId) return { error: "friendId required" };
  // friendId = celui qui m'a invité (donc user_id=friendId, friend_id=userId)
  const { error } = await admin
    .from("friendships")
    .update({ status: "accepted" })
    .eq("user_id", friendId)
    .eq("friend_id", userId)
    .eq("status", "pending");
  if (error) return { error: error.message };
  // Crée l'inverse aussi (relation symétrique)
  await admin
    .from("friendships")
    .upsert({ user_id: userId, friend_id: friendId, status: "accepted" },
            { onConflict: "user_id,friend_id" });
  return { ok: true };
}

async function removeFriend(admin, userId, friendId) {
  if (!friendId) return { error: "friendId required" };
  // Supprime les 2 sens
  await admin.from("friendships").delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
  return { ok: true };
}

// ======================== PLAYDATES ========================

async function listPlaydates(admin, userId, opts = {}) {
  // Visibles : tous les playdates créés par moi, ou auxquels je participe,
  // ou créés par un de mes amis acceptés.
  // Récupère mes amis acceptés
  const { data: fr } = await admin
    .from("friendships")
    .select("user_id, friend_id, status")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  const friendIds = new Set();
  for (const r of (fr || [])) {
    friendIds.add(r.user_id === userId ? r.friend_id : r.user_id);
  }
  const visibleHosts = [userId, ...friendIds];
  let q = admin
    .from("playdates")
    .select(`id, user_id, place, geo_lat, geo_lon, scheduled_at, notes, max_dogs, created_at,
             host:user_id(id, name, email),
             attendees:playdate_attendees(user_id, dog_id, joined_at,
               profile:user_id(name),
               dog:dog_id(name, emoji))`)
    .in("user_id", visibleHosts)
    .order("scheduled_at", { ascending: true });
  if (opts.upcoming) q = q.gte("scheduled_at", new Date().toISOString());
  const { data, error } = await q;
  if (error) return { error: error.message };
  const list = (data || []).map(p => ({
    id: p.id,
    place: p.place,
    geo: { lat: p.geo_lat, lon: p.geo_lon },
    scheduledAt: p.scheduled_at,
    notes: p.notes,
    maxDogs: p.max_dogs || 4,
    isHost: p.user_id === userId,
    host: { id: p.host?.id, name: p.host?.name },
    attendees: (p.attendees || []).map(a => ({
      userId: a.user_id,
      userName: a.profile?.name || null,
      dogName: a.dog?.name || null,
      dogEmoji: a.dog?.emoji || "🐕",
      joinedAt: a.joined_at,
    })),
    iAttend: (p.attendees || []).some(a => a.user_id === userId),
  }));
  return { playdates: list };
}

async function createPlaydate(admin, userId, body) {
  const { place, scheduledAt, geoLat, geoLon, notes, maxDogs, dogId } = body || {};
  if (!place || !scheduledAt) return { error: "place and scheduledAt required" };
  const { data: pd, error } = await admin.from("playdates").insert({
    user_id: userId,
    place: String(place).slice(0, 200),
    scheduled_at: new Date(scheduledAt).toISOString(),
    geo_lat: geoLat || null,
    geo_lon: geoLon || null,
    notes: notes ? String(notes).slice(0, 500) : null,
    max_dogs: Math.max(2, Math.min(10, parseInt(maxDogs || 4, 10))),
  }).select().maybeSingle();
  if (error) return { error: error.message };
  // Auto-join l'host
  await admin.from("playdate_attendees").insert({
    playdate_id: pd.id, user_id: userId, dog_id: dogId || null,
  });
  return { ok: true, playdate: pd };
}

async function joinPlaydate(admin, userId, playdateId, dogId) {
  if (!playdateId) return { error: "playdateId required" };
  const { error } = await admin.from("playdate_attendees").upsert({
    playdate_id: playdateId,
    user_id: userId,
    dog_id: dogId || null,
  }, { onConflict: "playdate_id,user_id" });
  if (error) return { error: error.message };
  return { ok: true };
}

async function leavePlaydate(admin, userId, playdateId) {
  if (!playdateId) return { error: "playdateId required" };
  await admin.from("playdate_attendees").delete()
    .eq("playdate_id", playdateId).eq("user_id", userId);
  return { ok: true };
}

async function cancelPlaydate(admin, userId, playdateId) {
  // host only — RLS s'occupe du check (delete only by owner)
  if (!playdateId) return { error: "playdateId required" };
  const { error } = await admin.from("playdates").delete()
    .eq("id", playdateId).eq("user_id", userId);
  if (error) return { error: error.message };
  return { ok: true };
}

// ======================== HANDLER ========================

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!supabaseEnabled) return mockResponse(res, { posts: [] });

  const admin = createAdminClient();
  const url = new URL(req.url, `http://${req.headers.host || "x"}`);
  const action = url.searchParams.get("action") || "";

  try {
    // Routes nécessitant auth
    const needsAuth = action || req.method !== "GET";
    let user = null;
    if (needsAuth) {
      user = await getUser(req);
      if (!user) return err(res, 401, "Auth required");
    }

    // ---- Friends actions ----
    if (action === "friends") {
      const r = await listFriends(admin, user.id);
      if (r.error) return err(res, 500, r.error);
      return json(res, 200, r);
    }
    if (action === "friend-request" && req.method === "POST") {
      const body = await readBody(req);
      const r = await sendFriendRequest(admin, user.id, body?.email);
      if (r.error) return err(res, 400, r.error, r.message);
      return json(res, 200, r);
    }
    if (action === "friend-accept" && req.method === "POST") {
      const body = await readBody(req);
      const r = await acceptFriendRequest(admin, user.id, body?.friendId);
      if (r.error) return err(res, 400, r.error);
      return json(res, 200, r);
    }
    if (action === "friend" && req.method === "DELETE") {
      const body = await readBody(req);
      const r = await removeFriend(admin, user.id, body?.friendId);
      return json(res, 200, r);
    }

    // ---- Playdates actions ----
    if (action === "playdates") {
      const upcoming = url.searchParams.get("upcoming") === "1";
      const r = await listPlaydates(admin, user.id, { upcoming });
      if (r.error) return err(res, 500, r.error);
      return json(res, 200, r);
    }
    if (action === "playdate-create" && req.method === "POST") {
      const body = await readBody(req);
      const r = await createPlaydate(admin, user.id, body);
      if (r.error) return err(res, 400, r.error);
      return json(res, 200, r);
    }
    if (action === "playdate-join" && req.method === "POST") {
      const body = await readBody(req);
      const r = await joinPlaydate(admin, user.id, body?.playdateId, body?.dogId);
      if (r.error) return err(res, 400, r.error);
      return json(res, 200, r);
    }
    if (action === "playdate-leave" && req.method === "DELETE") {
      const body = await readBody(req);
      const r = await leavePlaydate(admin, user.id, body?.playdateId);
      return json(res, 200, r);
    }
    if (action === "playdate-cancel" && req.method === "DELETE") {
      const body = await readBody(req);
      const r = await cancelPlaydate(admin, user.id, body?.playdateId);
      if (r.error) return err(res, 400, r.error);
      return json(res, 200, r);
    }

    // ---- Posts (default) ----
    if (req.method === "GET") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10), 100);
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
