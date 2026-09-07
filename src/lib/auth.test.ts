import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createKey } from "./api-keys";
import { checkApiKey, checkSameOrigin, getValidApiKeys } from "./auth";
import { getDb } from "./db";
import { addCredits, ensureUser, recordUsage, setUserPlan } from "./users";

function wipeUser(clerkId: string) {
  const db = getDb();
  db.prepare(`DELETE FROM user_api_keys WHERE clerk_id = ?`).run(clerkId);
  db.prepare(`DELETE FROM usage_events WHERE clerk_id = ?`).run(clerkId);
  db.prepare(`DELETE FROM users WHERE clerk_id = ?`).run(clerkId);
}

function fakeReq(headers: Record<string, string>, host = "woonscore.nl") {
  return { headers: new Headers(headers), nextUrl: { host } };
}

describe("checkSameOrigin", () => {
  it("staat same-origin browserverzoeken toe", () => {
    expect(checkSameOrigin(fakeReq({ "sec-fetch-site": "same-origin" })).ok).toBe(true);
  });

  it("weigert cross-site browserverzoeken", () => {
    const res = checkSameOrigin(fakeReq({ "sec-fetch-site": "cross-site" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("weigert verzoeken zonder herkomst (curl)", () => {
    expect(checkSameOrigin(fakeReq({})).ok).toBe(false);
  });

  it("valt terug op Origin-header voor oudere browsers", () => {
    expect(
      checkSameOrigin(fakeReq({ origin: "https://woonscore.nl" })).ok,
    ).toBe(true);
    expect(
      checkSameOrigin(fakeReq({ origin: "https://evil.example" })).ok,
    ).toBe(false);
  });

  it("valt terug op Referer-header", () => {
    expect(
      checkSameOrigin(fakeReq({ referer: "https://woonscore.nl/zakelijk" })).ok,
    ).toBe(true);
  });
});

describe("getValidApiKeys", () => {
  it("leest keys uit API_KEYS env", () => {
    const prev = process.env.API_KEYS;
    process.env.API_KEYS = "key-a, key-b,";
    try {
      const keys = getValidApiKeys();
      expect(keys.has("key-a")).toBe(true);
      expect(keys.has("key-b")).toBe(true);
      expect(keys.size).toBe(2);
    } finally {
      process.env.API_KEYS = prev;
    }
  });
});

describe("checkApiKey", () => {
  const clerkIds: string[] = [];
  afterEach(() => {
    for (const id of clerkIds.splice(0)) wipeUser(id);
  });

  it("weigert ontbrekende of ongeldige keys", () => {
    const missing = checkApiKey(null);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(401);

    const invalid = checkApiKey("niet-een-key");
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.status).toBe(403);
  });

  it("accepteert omgevingskeys als gratis plan", () => {
    const prev = process.env.API_KEYS;
    const envKey = `env-${randomBytes(6).toString("hex")}`;
    process.env.API_KEYS = envKey;
    try {
      const res = checkApiKey(envKey);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.plan).toBe("free");
        expect(res.bulkMax).toBe(5);
        expect(res.clerkId).toBeNull();
      }
    } finally {
      process.env.API_KEYS = prev;
    }
  });

  it("past maandlimiet en credits toe op account-keys", () => {
    const clerkId = `test_${randomBytes(8).toString("hex")}`;
    clerkIds.push(clerkId);
    ensureUser(clerkId);
    const created = createKey(clerkId, "test");
    if ("error" in created) throw new Error(created.error);

    for (let i = 0; i < 50; i++) recordUsage(clerkId, "api");
    const blocked = checkApiKey(created.raw);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.status).toBe(402);

    addCredits(clerkId, 1);
    const withCredit = checkApiKey(created.raw);
    expect(withCredit.ok).toBe(true);
    if (withCredit.ok) {
      expect(withCredit.plan).toBe("free");
      expect(withCredit.clerkId).toBe(clerkId);
    }
  });

  it("geeft zakelijke bulk-limiet terug", () => {
    const clerkId = `test_${randomBytes(8).toString("hex")}`;
    clerkIds.push(clerkId);
    ensureUser(clerkId);
    setUserPlan(clerkId, "zakelijk");
    const created = createKey(clerkId, "biz");
    if ("error" in created) throw new Error(created.error);
    const res = checkApiKey(created.raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan).toBe("zakelijk");
      expect(res.bulkMax).toBe(20);
      expect(res.hourly).toBe(300);
    }
  });
});
