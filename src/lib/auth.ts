import { getDb } from "./db";

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
  // Oudere browsers zonder Sec-Fetch-Site: val terug op Origin/Referer
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
const MAX_PER_WINDOW = 60;

export function getValidApiKeys(): Set<string> {
  const raw = process.env.API_KEYS ?? "demo-key-1,demo-key-2";
  return new Set(
    raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );
}

export function checkApiKey(key: string | null): { ok: true } | { ok: false; status: number; error: string } {
  if (!key) {
    return { ok: false, status: 401, error: "Missing X-API-Key header" };
  }
  if (!getValidApiKeys().has(key)) {
    return { ok: false, status: 403, error: "Invalid API key" };
  }
  if (!allowRate(key)) {
    return { ok: false, status: 429, error: "Rate limit exceeded (60 req/hour)" };
  }
  return { ok: true };
}

function allowRate(key: string): boolean {
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
  if (row.count >= MAX_PER_WINDOW) return false;
  db.prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`).run(key);
  return true;
}
