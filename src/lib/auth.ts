import { lookupKey, touchKey } from "./api-keys";
import { getDb } from "./db";
import { PLANS, type PlanId } from "./plans";
import {
  consumeCredit,
  ensureUser,
  monthlyUsage,
  planLimits,
  recordUsage,
} from "./users";

/**
 * Bescherming voor interne UI-endpoints (/api/score, /api/suggest, /api/bulk):
 * alleen fetches vanaf onze eigen frontend. Programmatische toegang loopt via
 * /api/v1/* met een API-key.
 */
export function checkSameOrigin(
  req: {
    headers: Headers;
    nextUrl: { host: string };
  },
  opts?: {
    /** Sta directe navigatie toe (adresbalk/bookmark), bv. voor PDF-downloads. */
    allowNavigation?: boolean;
  },
): { ok: true } | { ok: false; status: number; error: string } {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin") return { ok: true };
  if (secFetchSite === "none" && opts?.allowNavigation) return { ok: true };
  if (secFetchSite && secFetchSite !== "none") {
    return { ok: false, status: 403, error: "Alleen same-origin verzoeken; gebruik /api/v1 met een API-key" };
  }
  const ref = req.headers.get("origin") ?? req.headers.get("referer");
  if (ref) {
    try {
      if (new URL(ref).host === req.nextUrl.host) return { ok: true };
    } catch {
      // ongeldig origin/referer → afwijzen
    }
  }
  return {
    ok: false,
    status: 403,
    error: "Alleen same-origin verzoeken; gebruik /api/v1 met een API-key",
  };
}

const WINDOW_MS = 60 * 60 * 1000;

export function getValidApiKeys(): Set<string> {
  const raw = process.env.API_KEYS ?? "demo-key-1,demo-key-2";
  return new Set(
    raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );
}

export type ApiAuth =
  | {
      ok: true;
      plan: PlanId;
      clerkId: string | null;
      hourly: number;
      bulkMax: number;
    }
  | { ok: false; status: number; error: string };

export function checkApiKey(key: string | null): ApiAuth {
  if (!key) {
    return { ok: false, status: 401, error: "Missing X-API-Key header" };
  }

  const userKey = lookupKey(key);
  if (userKey) {
    const user = ensureUser(userKey.clerk_id);
    const limits = planLimits(user.plan);
    if (!allowRate(key, limits.hourly)) {
      return { ok: false, status: 429, error: `Rate limit exceeded (${limits.hourly} req/hour)` };
    }
    const used = monthlyUsage(user.clerk_id);
    if (used >= limits.monthly) {
      if (!consumeCredit(user.clerk_id)) {
        return {
          ok: false,
          status: 402,
          error: `Maandlimiet bereikt (${limits.monthly}). Upgrade of koop extra rapporten.`,
        };
      }
    }
    touchKey(userKey.id);
    recordUsage(user.clerk_id, "api");
    return {
      ok: true,
      plan: user.plan,
      clerkId: user.clerk_id,
      hourly: limits.hourly,
      bulkMax: limits.bulkMax,
    };
  }

  if (!getValidApiKeys().has(key)) {
    return { ok: false, status: 403, error: "Invalid API key" };
  }
  if (!allowRate(key, PLANS.free.hourly)) {
    return { ok: false, status: 429, error: "Rate limit exceeded (60 req/hour)" };
  }
  return {
    ok: true,
    plan: "free",
    clerkId: null,
    hourly: PLANS.free.hourly,
    bulkMax: PLANS.free.bulkMax,
  };
}

function allowRate(key: string, maxPerWindow: number): boolean {
  const db = getDb();
  const now = Date.now();
  const row = db
    .prepare(`SELECT window_start, count FROM rate_limits WHERE key = ?`)
    .get(key) as { window_start: number; count: number } | undefined;

  if (!row || now - row.window_start > WINDOW_MS) {
    db.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
    ).run(key, now);
    return true;
  }
  if (row.count >= maxPerWindow) return false;
  db.prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`).run(key);
  return true;
}
