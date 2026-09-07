import Stripe from "stripe";

/** Instantie-patroon (geen globale apiKey). Versie volgens Stripe best practices. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY ontbreekt");
  return new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ZAKELIJK);
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3015";
}
