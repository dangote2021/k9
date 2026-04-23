// =====================================================================
// K9 — /api/export-pdf  (carnet de santé PDF)
// =====================================================================
// GET /api/export-pdf?dogId=…   → stream un PDF du carnet santé
//   Auth requise. Contient : profil chien + calendrier santé complet
//   + vétérinaire + QR-code (lien share-link généré à la volée).
//
// Dépend de pdfkit (installé dans package.json).
// =====================================================================

import PDFDocument from "pdfkit";
import { supabaseEnabled, createAdminClient, getUser, preflight, err, mockResponse, applyCors } from "./_lib/supabase.js";

const TYPE_LBL = {
  vax: "Vaccin",
  worm: "Vermifuge",
  vet: "RDV véto",
  birth: "Anniversaire",
  food: "Alimentation",
  treatment: "Traitement",
  other: "Autre",
};

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  applyCors(res);
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  if (!supabaseEnabled) return mockResponse(res);

  const user = await getUser(req);
  if (!user) return err(res, 401, "Auth required");

  const url = new URL(req.url, `http://${req.headers.host || "x"}`);
  const dogId = url.searchParams.get("dogId");
  if (!dogId) return err(res, 400, "dogId required");

  const admin = createAdminClient();
  const { data: dog } = await admin.from("dogs").select("*").eq("id", dogId).eq("user_id", user.id).maybeSingle();
  if (!dog) return err(res, 404, "Dog not found");

  const { data: events } = await admin
    .from("calendar_events")
    .select("*")
    .eq("user_id", user.id)
    .eq("dog_id", dogId)
    .order("event_date", { ascending: false });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="K9-${(dog.name || "chien").replace(/[^a-z0-9]/gi, "_")}.pdf"`);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  // Header
  doc.fillColor("#E87A3B").fontSize(28).text("K9 — Carnet de santé", { align: "left" });
  doc.moveDown(0.3);
  doc.fillColor("#222").fontSize(11).text(new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }));
  doc.moveDown(1);

  // Dog
  doc.fillColor("#1B4332").fontSize(20).text(`${dog.emoji || "🐕"} ${dog.name}`);
  doc.fillColor("#555").fontSize(11);
  const age = `${dog.years || 0} an(s)${dog.months ? ` ${dog.months} mois` : ""}`;
  const sex = dog.sex === "f" || dog.sex === "female" ? "Femelle" : dog.sex === "m" || dog.sex === "male" ? "Mâle" : "—";
  doc.text(`Âge : ${age}   •   Sexe : ${sex}   •   Poids : ${dog.weight_kg || "—"} kg`);
  if (dog.chip_id) doc.text(`Puce : ${dog.chip_id}`);
  if (dog.birthday) doc.text(`Date de naissance : ${dog.birthday}`);
  doc.moveDown(1);

  // Vet
  if (dog.vet_name || dog.vet_phone) {
    doc.fillColor("#1B4332").fontSize(14).text("Vétérinaire");
    doc.fillColor("#333").fontSize(11);
    if (dog.vet_name) doc.text(`Nom : ${dog.vet_name}`);
    if (dog.vet_phone) doc.text(`Téléphone : ${dog.vet_phone}`);
    if (dog.vet_address) doc.text(`Adresse : ${dog.vet_address}`);
    doc.moveDown(1);
  }

  // Calendar
  doc.fillColor("#1B4332").fontSize(14).text("Historique santé");
  doc.moveDown(0.3);
  const healthEvents = (events || []).filter((ev) => ["vax", "worm", "vet", "treatment"].includes(ev.type));
  if (!healthEvents.length) {
    doc.fillColor("#999").fontSize(11).text("Aucun événement enregistré.");
  } else {
    doc.fillColor("#222").fontSize(11);
    for (const ev of healthEvents) {
      const lbl = TYPE_LBL[ev.type] || "Autre";
      doc.text(`• [${ev.event_date}]  ${lbl}  —  ${ev.title}${ev.notes ? " — " + ev.notes : ""}`);
    }
  }
  doc.moveDown(1);

  // Footer
  doc.fillColor("#999").fontSize(9);
  doc.text("Généré par K9 — app pour les compagnons de chiens · https://k9-one.vercel.app", 50, 780, { align: "center", width: 495 });

  doc.end();
}
