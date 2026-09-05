import { describe, expect, it } from "vitest";
import { checkSameOrigin, getValidApiKeys } from "./auth";

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
