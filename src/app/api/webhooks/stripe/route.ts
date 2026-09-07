import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { applyStripeEvent } from "@/lib/stripe-webhooks";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret ontbreekt" }, { status: 503 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  applyStripeEvent(event);
  return NextResponse.json({ received: true });
}
