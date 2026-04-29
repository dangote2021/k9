// =====================================================================
// K9 — api/_lib/supabase.js
// =====================================================================
// Helpers partagés pour tous les endpoints serveur.
//   - createAdminClient() : service-role (bypass RLS — à utiliser avec
//     parcimonie, seulement pour cron/webhook)
//   - createUserClient(req) : lit le token Authorization: Bearer <jwt>
//     côté client et retourne un client RLS-aware + l'user
//   - applyCors / json / err : helpers HTTP uniformes
//
// Philosophie : inspirée d'Adventurer — un seul point d'entrée Supabase,
// tous les endpoints partent de là. Gère proprement le cas "Supabase non
// configuré" (mode mock) pour ne pas casser le déploiement initial.
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;

// IMPORTANT : K9 partage la base Supabase avec un autre produit (ravito).
// Tout vit dans le schéma `k9` — chaque client doit le déclarer pour que
// l'header Accept-Profile / Content-Profile soit envoyé à PostgREST.
// (Ce schéma DOIT être ajouté dans Dashboard → Settings → API → Exposed schemas)
const K9_SCHEMA = "k9";

// Storage buckets : namespace `k9-` pour isolation
export const BUCKETS = {
  DOG_PHOTOS:   "k9-dog-photos",
  ALERT_PHOTOS: "k9-alert-photos",
  POST_PHOTOS:  "k9-post-photos",
  VET_SCANS:    "k9-vet-scans",
};

export const supabaseEnabled = !!(URL && SERVICE && ANON);

let _admin = null;
export function createAdminClient() {
  if (!supabaseEnabled) return null;
  if (!_admin) {
    _admin = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: K9_SCHEMA },
    });
  }
  return _admin;
}

export function createUserClient(req) {
  if (!supabaseEnabled) return null;
  const auth = req.headers?.authorization || req.headers?.Authorization || "";
  const token = (auth + "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: K9_SCHEMA },
  });
}

// Récupère l'user à partir du token. Retourne null si invalide.
export async function getUser(req) {
  const admin = createAdminClient();
  if (!admin) return null;
  const auth = req.headers?.authorization || req.headers?.Authorization || "";
  const token = (auth + "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// ---------- HTTP helpers ---------------------------------------------

export function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function preflight(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") { res.status(200).end(); return true; }
  return false;
}

export async function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function err(res, status, message, detail) {
  json(res, status, { error: message, ...(detail ? { detail } : {}) });
}

// ---------- Mock fallback --------------------------------------------
// Quand Supabase n'est pas branché, chaque endpoint peut répondre "mock"
// plutôt que 500 — le client continue en mode localStorage.
export function mockResponse(res, extra = {}) {
  json(res, 200, {
    mock: true,
    message: "Supabase not configured — running in localStorage-only mode.",
    ...extra,
  });
}
