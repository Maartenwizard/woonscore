import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { CREDIT_PACK_SIZE } from "@/lib/plans";
import { appUrl, getStripe, stripeConfigured } from "@/lib/stripe";
import { ensureUser, setStripeCustomer } from "@/lib/users";

export async function POST(req: NextRequest) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Betalen is nog niet geconfigureerd (STRIPE_SECRET_KEY / prijzen ontbreken)" },
      { status: 503 },
    );
  }

  let kind: "zakelijk" | "credits" = "zakelijk";
  try {
    const body = await req.json();
    if (body?.kind === "credits") kind = "credits";
  } catch {
    // default zakelijk
  }

  const priceId =
    kind === "credits" ? process.env.STRIPE_PRICE_CREDITS : process.env.STRIPE_PRICE_ZAKELIJK;
  if (!priceId) {
    return NextResponse.json({ error: "Stripe-prijs ontbreekt" }, { status: 503 });
  }

  const user = ensureUser(userId);
  const me = await currentUser();
  const stripe = getStripe();
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: me?.primaryEmailAddress?.emailAddress,
      name: me?.fullName ?? undefined,
      metadata: { clerkUserId: userId },
    });
    customerId = customer.id;
    setStripeCustomer(userId, customerId);
  }

  const suffix = Math.random().toString(36).slice(2, 10);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: kind === "credits" ? "payment" : "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl()}/account?checkout=success`,
    cancel_url: `${appUrl()}/prijzen?checkout=canceled`,
    client_reference_id: userId,
    metadata: {
      clerkUserId: userId,
      kind,
      credits: kind === "credits" ? String(CREDIT_PACK_SIZE) : "",
    },
    integration_identifier: `woonscore-checkout-${kind}-${suffix}`,
    ...(kind === "zakelijk"
      ? {
          subscription_data: {
            metadata: { clerkUserId: userId, kind: "zakelijk" },
          },
        }
      : {}),
  });

  return NextResponse.json({ url: session.url });
}
