import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createKey, generateApiKey, hashApiKey, listKeys } from "./api-keys";
import { getDb } from "./db";
import { CREDIT_PACK_SIZE, PLANS } from "./plans";
import { applyStripeEvent } from "./stripe-webhooks";
import { addCredits, consumeCredit, ensureUser, getUser, monthlyUsage, setStripeCustomer } from "./users";

function wipeUser(clerkId: string) {
  const db = getDb();
  db.prepare(`DELETE FROM user_api_keys WHERE clerk_id = ?`).run(clerkId);
  db.prepare(`DELETE FROM usage_events WHERE clerk_id = ?`).run(clerkId);
  db.prepare(`DELETE FROM users WHERE clerk_id = ?`).run(clerkId);
}

describe("plans", () => {
  it("heeft strengere limieten op gratis dan zakelijk", () => {
    expect(PLANS.free.monthly).toBeLessThan(PLANS.zakelijk.monthly);
    expect(PLANS.free.hourly).toBeLessThan(PLANS.zakelijk.hourly);
    expect(PLANS.free.bulkMax).toBeLessThan(PLANS.zakelijk.bulkMax);
    expect(PLANS.zakelijk.priceMonthlyEur).toBe(29);
    expect(CREDIT_PACK_SIZE).toBe(50);
  });
});

describe("api-keys", () => {
  const clerkIds: string[] = [];
  afterEach(() => {
    for (const id of clerkIds.splice(0)) wipeUser(id);
  });

  it("hasht deterministisch en toont alleen een prefix", () => {
    const { raw, prefix, hash } = generateApiKey();
    expect(raw.startsWith("ws_")).toBe(true);
    expect(prefix).toBe(raw.slice(0, 10));
    expect(hashApiKey(raw)).toBe(hash);
    expect(hash).not.toContain(raw);
  });

  it("limiteert het aantal keys op het gratis plan", () => {
    const clerkId = `test_${randomBytes(8).toString("hex")}`;
    clerkIds.push(clerkId);
    ensureUser(clerkId);
    const first = createKey(clerkId, "een");
    expect("raw" in first).toBe(true);
    const second = createKey(clerkId, "twee");
    expect("error" in second).toBe(true);
    expect(listKeys(clerkId)).toHaveLength(1);
  });
});

describe("users credits", () => {
  const clerkIds: string[] = [];
  afterEach(() => {
    for (const id of clerkIds.splice(0)) wipeUser(id);
  });

  it("consumeert extra credits tot ze op zijn", () => {
    const clerkId = `test_${randomBytes(8).toString("hex")}`;
    clerkIds.push(clerkId);
    ensureUser(clerkId);
    expect(consumeCredit(clerkId)).toBe(false);
    addCredits(clerkId, 2);
    expect(consumeCredit(clerkId)).toBe(true);
    expect(consumeCredit(clerkId)).toBe(true);
    expect(consumeCredit(clerkId)).toBe(false);
    expect(getUser(clerkId)?.extra_credits).toBe(0);
  });
});

describe("applyStripeEvent", () => {
  const clerkIds: string[] = [];
  afterEach(() => {
    for (const id of clerkIds.splice(0)) wipeUser(id);
  });

  it("schrijft credits bij checkout.session.completed", () => {
    const clerkId = `test_${randomBytes(8).toString("hex")}`;
    clerkIds.push(clerkId);
    ensureUser(clerkId);
    applyStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          client_reference_id: clerkId,
          metadata: { clerkUserId: clerkId, kind: "credits", credits: "50" },
        },
      } as never,
    });
    expect(getUser(clerkId)?.extra_credits).toBe(50);
  });

  it("zet plan op zakelijk bij een abonnement en terug naar free bij cancel", () => {
    const clerkId = `test_${randomBytes(8).toString("hex")}`;
    clerkIds.push(clerkId);
    ensureUser(clerkId);
    setStripeCustomer(clerkId, "cus_test_fase3");

    applyStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: clerkId,
          metadata: { clerkUserId: clerkId, kind: "zakelijk" },
        },
      } as never,
    });
    expect(getUser(clerkId)?.plan).toBe("zakelijk");

    applyStripeEvent({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus_test_fase3",
          status: "canceled",
          metadata: { clerkUserId: clerkId },
        },
      } as never,
    });
    expect(getUser(clerkId)?.plan).toBe("free");
  });

  it("telt monthlyUsage", () => {
    const clerkId = `test_${randomBytes(8).toString("hex")}`;
    clerkIds.push(clerkId);
    ensureUser(clerkId);
    expect(monthlyUsage(clerkId)).toBe(0);
  });
});
