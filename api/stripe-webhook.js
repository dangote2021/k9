// K9 — Stripe Webhook endpoint
// Receives subscription events from Stripe and persists the user's plan status.
// Required env vars:
//   STRIPE_SECRET_KEY       sk_live_... (or sk_test_...)
//   STRIPE_WEBHOOK_SECRET   whsec_... (from Stripe dashboard > Webhooks > Signing secret)
// Optional: SUPABASE_URL + SUPABASE_SERVICE_KEY to persist to the `subscriptions` table.

import Stripe from "stripe";

export const config = {
  api: {
    bodyParser: false, // Stripe requires raw body for signature verification
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !whSecret) {
    console.warn("Stripe webhook called but env vars missing");
    res.status(200).send("ok (no stripe configured)");
    return;
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2024-11-20.acacia" });

  let event;
  try {
    const raw = await getRawBody(req);
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (e) {
    console.error("Invalid Stripe signature:", e.message);
    res.status(400).send(`Webhook Error: ${e.message}`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const plan = s.metadata?.plan || (s.subscription ? "plus" : "free");
        const email = s.customer_email || s.customer_details?.email || null;
        console.log("[stripe] checkout complete", { email, plan, sessionId: s.id });
        await persistSubscription({
          email,
          plan,
          status: "active",
          stripeCustomerId: s.customer,
          stripeSubscriptionId: s.subscription,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object;
        const plan = sub.metadata?.plan || "plus";
        console.log("[stripe] subscription update", { plan, status: sub.status, id: sub.id });
        await persistSubscription({
          plan,
          status: sub.status,
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        console.log("[stripe] subscription canceled", { id: sub.id });
        await persistSubscription({
          plan: "free",
          status: "canceled",
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
        });
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        console.warn("[stripe] payment failed", { email: inv.customer_email, id: inv.id });
        break;
      }
      default:
        // unhandled event types are fine, ack anyway
        break;
    }
    res.status(200).json({ received: true });
  } catch (e) {
    console.error("webhook handler error:", e);
    res.status(500).send("handler error");
  }
}

async function persistSubscription(row) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    // No DB configured yet — just log. Safe in beta.
    console.log("[stripe] would persist:", row);
    return;
  }
  try {
    const payload = {
      email: row.email,
      plan: row.plan,
      status: row.status,
      stripe_customer_id: row.stripeCustomerId,
      stripe_subscription_id: row.stripeSubscriptionId,
      updated_at: new Date().toISOString(),
    };
    // Upsert by stripe_subscription_id
    const resp = await fetch(`${url}/rest/v1/subscriptions?on_conflict=stripe_subscription_id`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) console.error("Supabase upsert failed:", await resp.text());
  } catch (e) {
    console.error("persistSubscription error:", e);
  }
}
