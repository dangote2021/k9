// K9 — Stripe Customer Portal
// Returns a one-time URL for the user to manage their subscription (cancel, update card, view invoices).
// Required env vars: STRIPE_SECRET_KEY
// The client sends the Stripe customer id (stored locally after successful checkout).

import Stripe from "stripe";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) { res.status(200).json({ mock: true, url: null }); return; }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { customerId } = body || {};
    if (!customerId) { res.status(400).json({ error: "Missing customerId" }); return; }

    const stripe = new Stripe(secretKey, { apiVersion: "2024-11-20.acacia" });
    const siteUrl = process.env.PUBLIC_SITE_URL || "https://k9-one.vercel.app";
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: siteUrl,
    });
    res.status(200).json({ url: portal.url });
  } catch (e) {
    console.error("stripe-portal error:", e);
    res.status(500).json({ error: "Portal error", detail: String(e && e.message || e) });
  }
}
