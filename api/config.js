// =====================================================================
// K9 — /api/config  (configuration publique pour le client)
// =====================================================================
// GET /api/config → { supabaseUrl, supabaseAnonKey, vapidPublicKey, cloudEnabled }
// Aucune authentification. Pas de secrets (anon key uniquement).
// Permet au frontend single-HTML de s'auto-configurer selon l'env Vercel.
// =====================================================================

import { applyCors, preflight, json } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  applyCors(res);
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || null;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || null;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || null;
  const publicAppUrl = process.env.PUBLIC_APP_URL || null;
  const cloudEnabled = !!(supabaseUrl && supabaseAnonKey);

  return json(res, 200, {
    supabaseUrl, supabaseAnonKey, vapidPublicKey, publicAppUrl, cloudEnabled,
  });
}
