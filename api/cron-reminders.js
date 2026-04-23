// =====================================================================
// K9 — /api/cron-reminders  (exécuté tous les matins par Vercel Cron)
// =====================================================================
// Scanne calendar_events pour :
//   • J-0 (aujourd'hui)
//   • J+3 (dans 3 jours)
//   • non encore notifiés (reminded_at null)
// Envoie :
//   1) un email via Resend
//   2) une push notification web via web-push (si subscription active)
// Marque reminded_at après succès.
//
// Planifié dans vercel.json :
//   "crons": [{ "path": "/api/cron-reminders", "schedule": "0 7 * * *" }]
// =====================================================================

import { Resend } from "resend";
import webpush from "web-push";
import { supabaseEnabled, createAdminClient, json, err } from "./_lib/supabase.js";

const TYPE_LBL = {
  vax: "Vaccin", worm: "Vermifuge", vet: "RDV véto",
  birth: "Anniversaire", food: "Alimentation", treatment: "Traitement", other: "Rappel",
};

export default async function handler(req, res) {
  // Vercel Cron authenticity check (optionnel)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return err(res, 401, "Unauthorized cron call");
  }

  if (!supabaseEnabled || !process.env.RESEND_API_KEY) {
    return json(res, 200, {
      mock: true,
      reason: `supabase:${supabaseEnabled} resend:${!!process.env.RESEND_API_KEY}`,
    });
  }

  const admin = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:noreply@k9.app";
  const pushReady = !!(vapidPublic && vapidPrivate);
  if (pushReady) webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  // Fenêtre temporelle
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const in3 = new Date(today); in3.setUTCDate(in3.getUTCDate() + 3);
  const dates = [today.toISOString().slice(0, 10), in3.toISOString().slice(0, 10)];

  const { data: events } = await admin
    .from("calendar_events")
    .select("id, user_id, dog_id, title, type, event_date, dogs(name, emoji)")
    .in("event_date", dates)
    .is("reminded_at", null);

  let emailsSent = 0;
  let pushSent = 0;
  let errors = 0;

  for (const ev of events || []) {
    try {
      // Email
      const { data: u } = await admin.auth.admin.getUserById(ev.user_id);
      const email = u?.user?.email;
      const dogName = ev.dogs?.name || "ton chien";
      const dogEmoji = ev.dogs?.emoji || "🐕";
      const daysLeft = Math.round((new Date(ev.event_date) - today) / 86400000);
      const when = daysLeft === 0 ? "aujourd'hui" : `dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`;
      const typeLbl = TYPE_LBL[ev.type] || "Rappel";

      if (email) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "K9 <noreply@k9.app>",
          to: email,
          subject: `${dogEmoji} K9 · ${ev.title} — ${when}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#222">
              <h1 style="color:#E87A3B;font-size:22px">${dogEmoji} Rappel K9</h1>
              <p><strong>${typeLbl}</strong> pour <strong>${dogName}</strong> :</p>
              <div style="background:#FFF1E8;border:1px solid #E87A3B;border-radius:12px;padding:16px;margin:16px 0">
                <div style="font-size:18px;font-weight:600;color:#1B4332">${ev.title}</div>
                <div style="color:#555;margin-top:4px">${when} — ${ev.event_date}</div>
              </div>
              <p style="color:#666;font-size:14px">Ouvre K9 pour voir tout l'historique santé de ${dogName}.</p>
              <p style="margin-top:24px;color:#999;font-size:12px">K9 · app pour les compagnons de chiens · <a href="https://k9-one.vercel.app" style="color:#E87A3B">k9-one.vercel.app</a></p>
            </div>`,
        });
        emailsSent++;
      }

      // Web Push
      if (pushReady) {
        const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", ev.user_id);
        for (const s of subs || []) {
          try {
            await webpush.sendNotification({
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            }, JSON.stringify({
              title: `${dogEmoji} K9 — ${typeLbl}`,
              body: `${ev.title} ${when} pour ${dogName}`,
              url: "/?tab=health",
            }));
            pushSent++;
          } catch (pushErr) {
            // Si endpoint expiré → on le supprime
            if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
              await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
            }
          }
        }
      }

      await admin.from("calendar_events").update({ reminded_at: new Date().toISOString() }).eq("id", ev.id);
    } catch (e) {
      console.error("cron reminder error on event", ev.id, e);
      errors++;
    }
  }

  return json(res, 200, {
    ok: true,
    scanned: events?.length || 0,
    emailsSent, pushSent, errors,
  });
}
