// K9 — Stripe Checkout endpoint
// Creates a Stripe Checkout Session for the K9 Plus / K9 Pro subscription.
// Required env vars (Vercel project > Settings > Environment Variables):
//   STRIPE_SECRET_KEY      sk_live_... (or sk_test_... for testing)
//   STRIPE_PRICE_PLUS      price_... (the price ID for K9 Plus, 5,99€/mo)
//   STRIPE_PRICE_PRO       price_... (the price ID for K9 Pro, 12€/mo)
//   PUBLIC_SITE_URL        optional, defaults to https://k9-one.vercel.app

import Stripe from "stripe";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { plan, email, lang = "fr" } = body || {};

    if (!["plus", "pro"].includes(plan)) {
      res.status(400).json({ error: "Invalid plan" });
      return;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = plan === "plus" ? process.env.STRIPE_PRICE_PLUS : process.env.STRIPE_PRICE_PRO;

    if (!secretKey || !priceId) {
      // Graceful fallback while Stripe isn't wired up yet
      res.status(200).json({
        mock: true,
        message: lang === "fr"
          ? "⚙️ Stripe n'est pas encore connecté. Ajoute STRIPE_SECRET_KEY, STRIPE_PRICE_PLUS et STRIPE_PRICE_PRO dans Vercel pour activer le paiement."
          : "⚙️ Stripe isn't wired up yet. Add STRIPE_SECRET_KEY, STRIPE_PRICE_PLUS and STRIPE_PRICE_PRO to Vercel env vars to enable billing.",
      });
      return;
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2024-11-20.acacia" });
    const siteUrl = process.env.PUBLIC_SITE_URL || "https://k9-one.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      allow_promotion_codes: true,
      locale: lang === "fr" ? "fr" : "en",
      success_url: `${siteUrl}/?checkout=success&plan=${plan}&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancel`,
      metadata: { plan },
      subscription_data: {
        metadata: { plan },
      },
    });

    res.status(200).json({ url: session.url, id: session.id });
  } catch (e) {
    console.error("stripe-checkout error:", e);
    res.status(500).json({ error: "Checkout error", detail: String(e && e.message || e) });
  }
}
