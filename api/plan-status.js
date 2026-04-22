// K9 — Plan status lookup (after Stripe checkout redirect)
// Given a Checkout Session id, returns whether the payment succeeded and the plan.
// Used after the success redirect to unlock the plan locally.

import Stripe from "stripe";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) { res.status(200).json({ ok: false, reason: "stripe-not-configured" }); return; }

  const sid = (req.query && req.query.sid) || "";
  if (!sid) { res.status(400).json({ error: "Missing sid" }); return; }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2024-11-20.acacia" });
    const s = await stripe.checkout.sessions.retrieve(sid, { expand: ["subscription"] });
    const paid = s.payment_status === "paid" || s.status === "complete";
    const plan = s.metadata?.plan || "free";
    res.status(200).json({
      ok: paid,
      plan,
      email: s.customer_email || s.customer_details?.email || null,
      subscriptionId: typeof s.subscription === "string" ? s.subscription : s.subscription?.id,
    });
  } catch (e) {
    console.error("plan-status error:", e);
    res.status(500).json({ error: "Lookup failed", detail: String(e && e.message || e) });
  }
}
