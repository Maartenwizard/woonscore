import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { DIENSTEN } from "@/lib/diensten";
import { attachStripeSession, createOrder } from "@/lib/orders";
import { appUrl, getStripe } from "@/lib/stripe";
import { ensureUser, setStripeCustomer } from "@/lib/users";

/**
 * Checkout voor een betaalde vervolgdienst (funderingscheck, keuring, …).
 * Gebruikt price_data zodat alleen STRIPE_SECRET_KEY nodig is.
 */
export async function POST(req: NextRequest) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Log eerst in om een check aan te vragen" }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Betalen is nog niet geconfigureerd (STRIPE_SECRET_KEY ontbreekt)" },
      { status: 503 },
    );
  }

  let body: { dienstId?: string; adres?: string; nummeraanduidingId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dienst = body.dienstId ? DIENSTEN[body.dienstId] : undefined;
  if (!dienst) {
    return NextResponse.json({ error: "Onbekende dienst" }, { status: 400 });
  }
  const adres = (body.adres ?? "").slice(0, 160).trim();
  if (!adres) {
    return NextResponse.json({ error: "adres required" }, { status: 400 });
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

  const orderId = createOrder({
    clerkId: userId,
    dienstId: dienst.id,
    dienstNaam: dienst.naam,
    adres,
    nummeraanduidingId: body.nummeraanduidingId?.slice(0, 20),
    amountCents: dienst.prijsCent,
  });

  const suffix = Math.random().toString(36).slice(2, 10);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: dienst.prijsCent,
          product_data: {
            name: `${dienst.naam} — ${adres}`,
            description: dienst.omschrijving,
          },
        },
      },
    ],
    success_url: `${appUrl()}/account?checkout=dienst`,
    cancel_url: `${appUrl()}/rapport/${encodeURIComponent(body.nummeraanduidingId ?? "")}`,
    client_reference_id: userId,
    metadata: {
      clerkUserId: userId,
      kind: "dienst",
      orderId: String(orderId),
      dienstId: dienst.id,
    },
    integration_identifier: `woonscore-dienst-${dienst.id}-${suffix}`,
  });

  attachStripeSession(orderId, session.id);
  return NextResponse.json({ url: session.url });
}
