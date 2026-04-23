// =====================================================================
// K9 — /api/scan-carnet  (OCR carnet véto via Claude Vision)
// =====================================================================
// POST /api/scan-carnet
//   body: { imageDataUrl: "data:image/jpeg;base64,…", lang: "fr" }
//   returns: { events: [{ type, title, date, notes }], rawText }
//
// Auth optionnelle : si connecté, on incrémente le quota IA. Sinon on
// limite à 1 scan / IP / jour (côté memory/cache — simple fallback).
// =====================================================================

import { supabaseEnabled, createAdminClient, getUser, applyCors, preflight, readBody, json, err } from "./_lib/supabase.js";

const SYSTEM_FR = `Tu es un assistant qui extrait les informations médicales d'une page de carnet vétérinaire canin (France).
Réponds STRICTEMENT en JSON avec ce schéma :

{
  "events": [
    { "type": "vax"|"worm"|"vet"|"treatment", "title": "…", "date": "YYYY-MM-DD", "notes": "…" }
  ],
  "warning": "…"   // uniquement si tu n'es pas sûr de certaines dates
}

Règles :
- type=vax pour les vaccins (CHPPL, leishmaniose, rage, leptospirose, piroplasmose…)
- type=worm pour vermifuge/antiparasitaire
- type=treatment pour traitements ponctuels (antibiotiques, anti-inflammatoires…)
- type=vet pour les visites (bilan annuel, consultation)
- date au format YYYY-MM-DD. Si seule l'année est lisible, mets YYYY-01-01 et ajoute une note "date approximative"
- Si la page est illisible ou ne contient pas de données vétérinaires, renvoie {"events": [], "warning": "..."}
- Ne renvoie RIEN d'autre que le JSON.`;

const SYSTEM_EN = `You extract medical information from a canine vet booklet page.
Respond STRICTLY in JSON with this schema:

{
  "events": [
    { "type": "vax"|"worm"|"vet"|"treatment", "title": "…", "date": "YYYY-MM-DD", "notes": "…" }
  ],
  "warning": "…"
}

Rules: vax=vaccines, worm=dewormer/antiparasitics, treatment=one-off treatments (antibiotics, anti-inflammatories), vet=visits (annual checkup). Date YYYY-MM-DD; if only year is readable use YYYY-01-01 and add a note. If unreadable, return {"events":[], "warning":"..."}. Nothing but JSON.`;

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const body = await readBody(req);
  const { imageDataUrl, lang = "fr" } = body || {};
  if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
    return err(res, 400, "imageDataUrl required (data:image/…base64,…)");
  }
  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return err(res, 400, "Invalid imageDataUrl format");
  const mediaType = match[1];
  const dataB64 = match[2];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(res, 200, {
      mock: true,
      events: [
        { type: "vax", title: "Exemple (IA non connectée)", date: "2024-09-15", notes: "" },
      ],
      warning: lang === "fr"
        ? "Claude n'est pas branché sur ce déploiement. Ajoutez ANTHROPIC_API_KEY dans Vercel."
        : "Claude not connected on this deployment.",
    });
  }

  // Quota check si authentifié
  if (supabaseEnabled) {
    const user = await getUser(req);
    if (user) {
      const admin = createAdminClient();
      const { data: quota } = await admin.rpc("ai_quota_increment", { p_limit: 3 });
      const row = Array.isArray(quota) ? quota[0] : quota;
      if (row && row.allowed === false) {
        return err(res, 429, "Daily AI quota reached (3/day on free tier — upgrade to K9 Plus).");
      }
    }
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: lang === "en" ? SYSTEM_EN : SYSTEM_FR,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: dataB64 } },
            { type: "text", text: lang === "en" ? "Extract all vet events from this booklet page." : "Extrais tous les événements vétérinaires de cette page de carnet." },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error("scan-carnet upstream error:", resp.status, detail);
      return err(res, 502, "Upstream vision error", detail);
    }

    const data = await resp.json();
    const raw = data?.content?.[0]?.text || "{}";
    // Parse JSON (Claude peut entourer de ```json)
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed = { events: [], warning: null };
    try { parsed = JSON.parse(cleaned); } catch {
      parsed = { events: [], warning: "JSON parse failed", raw: cleaned };
    }

    return json(res, 200, parsed);
  } catch (e) {
    console.error("scan-carnet handler error:", e);
    return err(res, 500, "Server error", String(e?.message || e));
  }
}
