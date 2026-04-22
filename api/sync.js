// =====================================================================
// K9 — /api/sync  (squelette Supabase)
// =====================================================================
// Ce endpoint accepte un snapshot K9Store et :
//   - GET  : renvoie le snapshot serveur le plus récent (quand Supabase actif)
//   - POST : upsert le snapshot client côté serveur (quand Supabase actif)
//
// Tant que les variables SUPABASE_URL / SUPABASE_SERVICE_KEY ne sont pas
// définies dans Vercel, ce endpoint répond 200 avec mock:true — le client
// reste en mode localStorage-only sans planter.
//
// Pour activer :
//   1. Créer un projet Supabase, exécuter db/schema.sql
//   2. Ajouter SUPABASE_URL + SUPABASE_SERVICE_KEY dans Vercel env
//   3. Ajouter SUPABASE_ANON_KEY côté front (pas critique pour ce stub)
//   4. Décommenter la section "DB" ci-dessous
// =====================================================================

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const supabaseEnabled = !!(supabaseUrl && supabaseKey);

  // Stub mode : localStorage only, on ne fait que valider le payload
  if (!supabaseEnabled) {
    if (req.method === "GET") {
      res.status(200).json({ mock: true, snapshot: null, message: "Supabase not configured — localStorage only mode." });
      return;
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      res.status(200).json({ mock: true, ok: true, echoed: body ? true : false });
      return;
    }
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // --- Supabase mode (à décommenter et tester quand Supabase est branché) ---
  /*
  // TODO: import { createClient } from "@supabase/supabase-js";
  // const supabase = createClient(supabaseUrl, supabaseKey);

  // Auth : extract user_id depuis le JWT Authorization: Bearer <token>
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) { res.status(401).json({ error: "Missing token" }); return; }
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) { res.status(401).json({ error: "Invalid token" }); return; }
  const userId = userData.user.id;

  if (req.method === "GET") {
    // Agrège profil + dogs + events + walks + rescue + settings
    const [p, d, c, w, r] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase.from("dogs").select("*").eq("user_id", userId).order("position"),
      supabase.from("calendar_events").select("*").eq("user_id", userId).order("event_date"),
      supabase.from("walks").select("*").eq("user_id", userId).order("started_at", { ascending: false }),
      supabase.from("rescue_entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    res.status(200).json({
      snapshot: {
        v: 1,
        owner: { name: p.data?.name || "" },
        settings: {
          lang: p.data?.lang || "fr",
          useImperial: !!p.data?.use_imperial,
          aiSoftMode: !!p.data?.ai_soft_mode,
          a11y: !!p.data?.a11y_large,
        },
        dogs: d.data || [],
        calendarEvents: c.data || [],
        walkHistory: w.data || [],
        rescueEntries: r.data || [],
      },
    });
    return;
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const snap = body?.snapshot;
    if (!snap) { res.status(400).json({ error: "Missing snapshot" }); return; }

    // Upsert profile
    await supabase.from("profiles").upsert({
      user_id: userId,
      name: snap.owner?.name || null,
      lang: snap.settings?.lang || "fr",
      use_imperial: !!snap.settings?.useImperial,
      ai_soft_mode: !!snap.settings?.aiSoftMode,
      a11y_large: !!snap.settings?.a11y,
    });

    // Upsert dogs — simplifié, à raffiner
    for (const [i, dog] of (snap.dogs || []).entries()) {
      await supabase.from("dogs").upsert({
        id: dog.id, user_id: userId, name: dog.name, breed_idx: dog.breed,
        years: dog.years, months: dog.months, sex: dog.sex, weight_kg: dog.weight,
        emoji: dog.emoji, coat: dog.coat, photo_data_url: dog.photo,
        is_active: i === (snap.activeDogIdx || 0), position: i,
      });
    }

    // Upsert events
    for (const ev of (snap.calendarEvents || [])) {
      await supabase.from("calendar_events").upsert({
        id: ev.id, user_id: userId, type: ev.type, title: ev.title,
        event_date: ev.date, notes: ev.notes || null,
      });
    }

    // Upsert walks — append-only (on ne modifie pas un historique)
    for (const w of (snap.walkHistory || [])) {
      await supabase.from("walks").upsert({
        id: w.id, user_id: userId, started_at: w.startedAt, ended_at: w.endedAt,
        duration_min: w.durationMin, distance_km: w.distanceKm, source: w.source || "timer",
      });
    }

    res.status(200).json({ ok: true, synced_at: new Date().toISOString() });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
  */

  // Fallback si supabaseEnabled mais Supabase n'est pas encore décommenté
  res.status(503).json({ error: "Supabase enabled but handler not activated — uncomment DB section in api/sync.js" });
}
