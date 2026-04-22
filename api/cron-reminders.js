// =====================================================================
// K9 — /api/cron-reminders  (planifié par Vercel Cron)
// =====================================================================
// S'exécute tous les matins (7h Europe/Paris par défaut — configurable
// dans vercel.json). Scanne calendar_events pour J-3 et J-0, envoie un
// email via Resend (ou SMS via Twilio) et marque reminded_at.
//
// Tant que Supabase + Resend ne sont pas configurés, cet endpoint
// renvoie 200 {mock:true} et ne fait rien.
//
// Pour activer :
//   1. Brancher Supabase (voir api/sync.js)
//   2. Créer compte Resend (resend.com), récupérer RESEND_API_KEY
//   3. Ajouter RESEND_API_KEY + RESEND_FROM_EMAIL dans Vercel
//   4. Ajouter dans vercel.json :
//        "crons": [{ "path": "/api/cron-reminders", "schedule": "0 7 * * *" }]
//   5. Décommenter la section "run" ci-dessous
// =====================================================================

export default async function handler(req, res) {
  // Vercel Cron sends a specific header ; on pourra le valider en prod
  // const isCron = req.headers["x-vercel-cron"] === "1";

  const supabaseReady = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
  const resendReady = !!process.env.RESEND_API_KEY;

  if (!supabaseReady || !resendReady) {
    res.status(200).json({
      mock: true,
      ran: false,
      reason: `Waiting for env vars — supabase:${supabaseReady} resend:${resendReady}`,
    });
    return;
  }

  // --- Production flow (à décommenter quand supabase + resend sont branchés) ---
  /*
  // TODO: import { createClient } from "@supabase/supabase-js";
  // TODO: import { Resend } from "resend";
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Fenêtre : événements dont event_date = today OR today+3, non encore notifiés
  const today = new Date(); today.setHours(0,0,0,0);
  const in3 = new Date(today); in3.setDate(in3.getDate() + 3);

  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, user_id, title, type, event_date, dog_id, dogs(name)")
    .in("event_date", [today.toISOString().slice(0,10), in3.toISOString().slice(0,10)])
    .is("reminded_at", null);

  let sent = 0;
  for (const ev of events || []) {
    // Récupère l'email user
    const { data: u } = await supabase.auth.admin.getUserById(ev.user_id);
    const email = u?.user?.email;
    if (!email) continue;

    const daysLeft = Math.round((new Date(ev.event_date) - today) / 86400000);
    const when = daysLeft === 0 ? "aujourd'hui" : `dans ${daysLeft} jours`;
    const typeLbl = { vax:"Vaccin", worm:"Vermifuge", vet:"RDV véto", birth:"Anniversaire", food:"Alimentation", other:"Rappel" }[ev.type] || "Rappel";
    const dogName = ev.dogs?.name || "";

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "K9 <noreply@k9.app>",
      to: email,
      subject: `🐶 K9 · ${ev.title} ${when}`,
      html: `<p>Hello !</p><p><strong>${typeLbl}</strong> pour ${dogName || "ton chien"} : <strong>${ev.title}</strong> — ${when} (${ev.event_date}).</p><p>Bonne journée.</p><p style="color:#999;font-size:12px">K9 · app pour les compagnons de chiens</p>`,
    });
    await supabase.from("calendar_events").update({ reminded_at: new Date().toISOString() }).eq("id", ev.id);
    sent++;
  }

  res.status(200).json({ ok: true, sent, scanned: events?.length || 0 });
  return;
  */

  res.status(503).json({ error: "Env configured but handler not activated — uncomment run section in api/cron-reminders.js" });
}
