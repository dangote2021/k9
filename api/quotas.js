// =====================================================================
// K9 — /api/quotas  (vérifier / consommer quota IA journalier)
// =====================================================================
// GET  /api/quotas            → { plan, usedToday, limit, remaining }
// POST /api/quotas            → incrémente atomiquement (returns allowed)
//
// Règle : 3/jour en free, illimité pour Plus/Pro (RPC côté DB).
// =====================================================================

import { supabaseEnabled, createAdminClient, getUser, preflight, json, err, mockResponse } from "./_lib/supabase.js";

const FREE_DAILY = 3;

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!supabaseEnabled) return mockResponse(res, { plan: "free", usedToday: 0, limit: FREE_DAILY, remaining: FREE_DAILY });

  const user = await getUser(req);
  if (!user) return err(res, 401, "Auth required");
  const admin = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);
  const { data: profile } = await admin.from("profiles").select("plan").eq("user_id", user.id).maybeSingle();
  const { data: row } = await admin.from("ai_quotas").select("count").eq("user_id", user.id).eq("day", today).maybeSingle();

  const plan = profile?.plan || "free";
  const usedToday = row?.count || 0;
  const limit = plan === "free" ? FREE_DAILY : Infinity;
  const remaining = plan === "free" ? Math.max(0, FREE_DAILY - usedToday) : 999;

  if (req.method === "GET") {
    return json(res, 200, { plan, usedToday, limit: plan === "free" ? limit : null, remaining });
  }

  if (req.method === "POST") {
    const { data, error } = await admin.rpc("ai_quota_increment", { p_limit: FREE_DAILY });
    if (error) return err(res, 500, error.message);
    const r = Array.isArray(data) ? data[0] : data;
    return json(res, 200, {
      allowed: !!r?.allowed,
      countAfter: r?.count_after || 0,
      plan,
    });
  }

  return err(res, 405, "Method not allowed");
}
