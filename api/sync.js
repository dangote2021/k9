// =====================================================================
// K9 — /api/sync  (production-ready, activé quand Supabase est branché)
// =====================================================================
// GET  /api/sync  → renvoie { snapshot } agrégé depuis Supabase
// POST /api/sync  → upsert un snapshot K9Store côté serveur (merge non destructif)
//
// Auth : header "Authorization: Bearer <supabase_access_token>"
// En l'absence de Supabase configuré, on renvoie mock:true et le client
// continue en localStorage-only.
// =====================================================================

import { supabaseEnabled, createAdminClient, getUser, applyCors, preflight, readBody, json, err, mockResponse } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;

  if (!supabaseEnabled) {
    if (req.method === "GET" || req.method === "POST") {
      return mockResponse(res, { snapshot: null });
    }
    return err(res, 405, "Method not allowed");
  }

  const user = await getUser(req);
  if (!user) return err(res, 401, "Missing or invalid token");
  const admin = createAdminClient();

  try {
    if (req.method === "GET") {
      const [p, d, c, w, r, a, q] = await Promise.all([
        admin.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        admin.from("dogs").select("*").eq("user_id", user.id).order("position"),
        admin.from("calendar_events").select("*").eq("user_id", user.id).order("event_date"),
        admin.from("walks").select("*").eq("user_id", user.id).order("started_at", { ascending: false }).limit(200),
        admin.from("rescue_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
        admin.from("lost_found_alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        admin.from("ai_quotas").select("*").eq("user_id", user.id).order("day", { ascending: false }).limit(1),
      ]);

      const profile = p.data || {};
      const snapshot = {
        v: 2,
        savedAt: new Date().toISOString(),
        owner: { name: profile.name || "", email: profile.email || user.email || "" },
        onboardingDone: !!profile.name,
        activeDogIdx: (d.data || []).findIndex((x) => x.is_active) >= 0
          ? (d.data || []).findIndex((x) => x.is_active)
          : 0,
        dogs: (d.data || []).map((row) => ({
          id: row.id,
          name: row.name,
          breed: row.breed_idx,
          ageY: row.years,
          ageM: row.months,
          sex: row.sex,
          weight: row.weight_kg ? Number(row.weight_kg) : 0,
          emoji: row.emoji,
          coat: row.coat,
          photo: row.photo_url || row.photo_data_url || null,
          chipId: row.chip_id || "",
          birthday: row.birthday || "",
          goal: row.goal || "",
          exp: row.exp || "",
          vet: { name: row.vet_name || "", phone: row.vet_phone || "", address: row.vet_address || "" },
        })),
        calendarEvents: (c.data || []).map((row) => ({
          id: row.id,
          dogIdx: null, // résolu côté client à partir de dog_id
          dogId: row.dog_id,
          type: row.type,
          title: row.title,
          date: row.event_date,
          notes: row.notes || "",
        })),
        walkHistory: (w.data || []).map((row) => ({
          id: row.id,
          dogId: row.dog_id,
          startedAt: row.started_at,
          endedAt: row.ended_at,
          durationMin: row.duration_min,
          distanceKm: row.distance_km ? Number(row.distance_km) : 0,
          source: row.source,
          notes: row.notes,
        })),
        rescueEntries: (r.data || []).map((row) => ({
          id: row.id,
          dogId: row.dog_id,
          program: row.program,
          text: row.text,
          createdAt: row.created_at,
        })),
        lostFoundAlerts: (a.data || []).map((row) => ({
          id: row.id,
          type: row.type,
          dogName: row.dog_name,
          breed: row.breed,
          photo: row.photo_url || row.photo_data_url || null,
          place: row.place,
          description: row.description,
          contact: row.contact,
          resolved: row.resolved,
          createdAt: row.created_at,
        })),
        settings: {
          lang: profile.lang || "fr",
          useImperial: !!profile.use_imperial,
          aiSoftMode: !!profile.ai_soft_mode,
          a11y: !!profile.a11y_large,
          notifEnabled: !!profile.notif_enabled,
        },
        plan: {
          tier: profile.plan || "free",
          currentPeriodEnd: profile.plan_current_period_end,
        },
        aiQuotaToday: q.data?.[0]?.count || 0,
      };

      return json(res, 200, { snapshot });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const snap = body?.snapshot;
      if (!snap) return err(res, 400, "Missing snapshot");

      // 1. Profil
      await admin.from("profiles").upsert({
        user_id: user.id,
        name: snap.owner?.name || null,
        email: user.email,
        lang: snap.settings?.lang || "fr",
        use_imperial: !!snap.settings?.useImperial,
        ai_soft_mode: !!snap.settings?.aiSoftMode,
        a11y_large: !!snap.settings?.a11y,
        notif_enabled: !!snap.settings?.notifEnabled,
      }, { onConflict: "user_id" });

      // 2. Dogs (merge : on remplace par l'état client = source de vérité le plus récent)
      const clientDogs = snap.dogs || [];
      if (clientDogs.length) {
        const rows = clientDogs.map((dog, i) => ({
          id: dog.id, // may be undefined → supabase génère
          user_id: user.id,
          name: dog.name,
          breed_idx: dog.breed,
          years: dog.ageY ?? dog.years ?? 0,
          months: dog.ageM ?? dog.months ?? 0,
          sex: dog.sex,
          weight_kg: Number(dog.weight) || null,
          emoji: dog.emoji || "🐕",
          coat: dog.coat || null,
          photo_data_url: (dog.photo && dog.photo.startsWith?.("data:")) ? dog.photo : null,
          photo_url: (dog.photo && !dog.photo.startsWith?.("data:")) ? dog.photo : null,
          chip_id: dog.chipId || null,
          birthday: dog.birthday || null,
          goal: dog.goal || null,
          exp: dog.exp || null,
          vet_name: dog.vet?.name || null,
          vet_phone: dog.vet?.phone || null,
          vet_address: dog.vet?.address || null,
          is_active: i === (snap.activeDogIdx || 0),
          position: i,
        }));
        // On supprime d'abord les lignes qui n'existent plus côté client
        const incomingIds = rows.map((r) => r.id).filter(Boolean);
        if (incomingIds.length) {
          await admin.from("dogs").delete()
            .eq("user_id", user.id)
            .not("id", "in", `(${incomingIds.join(",")})`);
        }
        await admin.from("dogs").upsert(rows, { onConflict: "id" });
      }

      // 3. Calendar events
      for (const ev of snap.calendarEvents || []) {
        await admin.from("calendar_events").upsert({
          id: ev.id,
          user_id: user.id,
          dog_id: ev.dogId || null,
          type: ev.type,
          title: ev.title,
          event_date: ev.date,
          notes: ev.notes || null,
        }, { onConflict: "id" });
      }

      // 4. Walks — append-only, pas de delete (historique préservé)
      for (const w of snap.walkHistory || []) {
        await admin.from("walks").upsert({
          id: w.id,
          user_id: user.id,
          dog_id: w.dogId || null,
          started_at: w.startedAt,
          ended_at: w.endedAt,
          duration_min: w.durationMin,
          distance_km: w.distanceKm,
          source: w.source || "timer",
          track_points: w.trackPoints || null,
          notes: w.notes || null,
        }, { onConflict: "id" });
      }

      // 5. Rescue entries
      for (const r of snap.rescueEntries || []) {
        await admin.from("rescue_entries").upsert({
          id: r.id,
          user_id: user.id,
          dog_id: r.dogId || null,
          program: r.program || "rescue_3_3_3",
          text: r.text,
        }, { onConflict: "id" });
      }

      return json(res, 200, { ok: true, synced_at: new Date().toISOString() });
    }

    return err(res, 405, "Method not allowed");
  } catch (e) {
    console.error("sync handler error:", e);
    return err(res, 500, "Server error", String(e?.message || e));
  }
}
