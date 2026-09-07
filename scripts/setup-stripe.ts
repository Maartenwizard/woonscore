/**
 * Maakt aparte Stripe-producten per plan (niet meerdere tiers op één product)
 * en print de price-id's voor .env.local.
 *
 * Vereist STRIPE_SECRET_KEY. Zet daarna STRIPE_PRICE_ZAKELIJK,
 * STRIPE_PRICE_CREDITS en een webhook-secret (checkout + subscription events).
 *
 * Stripe Tax: zet automatic_tax pas aan ná een actieve EU/NL-registratie.
 */
import Stripe from "stripe";
import { CREDIT_PACK_EUR, CREDIT_PACK_SIZE, PLANS } from "../src/lib/plans";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY ontbreekt. Zet hem in .env.local en probeer opnieuw.");
    process.exit(1);
  }

  const stripe = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });

  const zakelijk = await stripe.products.create({
    name: "Woonscore Zakelijk",
    description: `${PLANS.zakelijk.monthly} API-rapporten/maand, ${PLANS.zakelijk.hourly} req/uur, ${PLANS.zakelijk.maxKeys} keys`,
    metadata: { plan: "zakelijk" },
  });
  const zakelijkPrice = await stripe.prices.create({
    product: zakelijk.id,
    currency: "eur",
    unit_amount: (PLANS.zakelijk.priceMonthlyEur ?? 29) * 100,
    recurring: { interval: "month" },
    nickname: "Zakelijk maandelijks",
  });

  const credits = await stripe.products.create({
    name: "Woonscore extra rapporten",
    description: `${CREDIT_PACK_SIZE} extra API-rapporten, eenmalig`,
    metadata: { kind: "credits", size: String(CREDIT_PACK_SIZE) },
  });
  const creditsPrice = await stripe.prices.create({
    product: credits.id,
    currency: "eur",
    unit_amount: CREDIT_PACK_EUR * 100,
    nickname: `${CREDIT_PACK_SIZE} credits`,
  });

  console.log("Producten aangemaakt. Zet in .env.local:\n");
  console.log(`STRIPE_PRICE_ZAKELIJK=${zakelijkPrice.id}`);
  console.log(`STRIPE_PRICE_CREDITS=${creditsPrice.id}`);
  console.log("\nWebhook: checkout.session.completed, customer.subscription.updated,");
  console.log("customer.subscription.deleted → /api/webhooks/stripe");
  console.log("Zet Customer Portal aan in het Stripe Dashboard (abonnement beheren).");
  console.log(
    "EU-btw: registreer Stripe Tax voordat je automatic_tax inschakelt — zonder registratie wordt geen btw geïnd.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
