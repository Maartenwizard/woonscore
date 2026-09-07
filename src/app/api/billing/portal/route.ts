import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { appUrl, getStripe, stripeConfigured } from "@/lib/stripe";
import { ensureUser } from "@/lib/users";

export async function POST() {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe is niet geconfigureerd" }, { status: 503 });
  }
  const user = ensureUser(userId);
  if (!user.stripe_customer_id) {
    return NextResponse.json({ error: "Geen Stripe-klant gekoppeld" }, { status: 400 });
  }
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${appUrl()}/account`,
  });
  return NextResponse.json({ url: session.url });
}
