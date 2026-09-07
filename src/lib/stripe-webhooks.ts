import type Stripe from "stripe";
import { markOrderPaid } from "./orders";
import { CREDIT_PACK_SIZE } from "./plans";
import { addCredits, getUserByStripeCustomer, setUserPlan } from "./users";

function clerkIdFromSession(session: Stripe.Checkout.Session): string | undefined {
  return session.metadata?.clerkUserId ?? session.client_reference_id ?? undefined;
}

function customerId(sub: Stripe.Subscription): string | undefined {
  if (typeof sub.customer === "string") return sub.customer;
  return sub.customer?.id;
}

function subscriptionIsPaid(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

/** Verwerkt een Stripe-event zonder HTTP. Testbaar zonder webhook-secret. */
export function applyStripeEvent(event: Pick<Stripe.Event, "type" | "data">) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const clerkId = clerkIdFromSession(session);
    if (!clerkId) return;
    if (session.metadata?.kind === "dienst") {
      const orderId = Number(session.metadata.orderId);
      if (orderId) markOrderPaid(orderId);
      return;
    }
    if (session.metadata?.kind === "credits") {
      addCredits(clerkId, Number(session.metadata.credits) || CREDIT_PACK_SIZE);
      return;
    }
    if (session.mode === "subscription") {
      setUserPlan(clerkId, "zakelijk");
    }
    return;
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const id = customerId(sub);
    const row = id ? getUserByStripeCustomer(id) : null;
    const clerkId = row?.clerk_id ?? sub.metadata?.clerkUserId;
    if (!clerkId) return;
    if (event.type === "customer.subscription.deleted") {
      setUserPlan(clerkId, "free");
      return;
    }
    setUserPlan(clerkId, subscriptionIsPaid(sub.status) ? "zakelijk" : "free");
  }
}
