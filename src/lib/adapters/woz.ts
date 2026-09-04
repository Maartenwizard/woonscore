import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { ResolvedAddress, WozFacts, WozPoint } from "@/lib/types";
import { runAdapter } from "./runner";

/** Serialize WOZ requests (concurrency 1). */
let wozChain: Promise<unknown> = Promise.resolve();

function enqueueWoz<T>(fn: () => Promise<T>): Promise<T> {
  const next = wozChain.then(fn, fn);
  wozChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function fetchWoz(address: ResolvedAddress): Promise<WozFacts | null> {
  const cacheKey = `woz:${address.nummeraanduidingId}`;
  const cached = cacheGet<WozFacts>(cacheKey);
  if (cached) return cached;

  return enqueueWoz(async () => {
    // Session cookie (GET — POST returns 405 on current loket)
    const sessionRes = await fetchWithTimeout(
      "https://www.wozwaardeloket.nl/wozwaardeloket-api/v1/session/start",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Woonscore/0.1",
        },
      },
      8000,
    );

    const setCookies =
      typeof sessionRes.headers.getSetCookie === "function"
        ? sessionRes.headers.getSetCookie()
        : [];
    const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");

    const res = await fetchWithTimeout(
      `https://www.wozwaardeloket.nl/wozwaardeloket-api/v1/wozwaarde/nummeraanduiding/${address.nummeraanduidingId}`,
      {
        headers: {
          Accept: "application/json",
          Referer: "https://www.wozwaardeloket.nl/",
          "User-Agent": "Woonscore/0.1",
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      10000,
    );

    if (res.status === 404) return null;
    const text = await res.text();
    if (!res.ok) throw new Error(`WOZ-waardeloket ${res.status}`);
    if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      // SPA shell — unofficial JSON endpoint currently unavailable
      throw new Error("WOZ-waardeloket JSON endpoint unavailable");
    }

    const json = JSON.parse(text) as Record<string, unknown>;
    const historieRaw =
      (json.wozWaarden as Array<Record<string, unknown>> | undefined) ??
      (json.wozwaarden as Array<Record<string, unknown>> | undefined) ??
      [];

    const historie: WozPoint[] = historieRaw
      .map((w) => ({
        peildatum: String(w.peildatum ?? w.Peildatum ?? ""),
        waarde: Number(w.vastgesteldeWaarde ?? w.vastgestelde_waarde ?? w.waarde ?? NaN),
      }))
      .filter((w) => w.peildatum && Number.isFinite(w.waarde))
      .sort((a, b) => a.peildatum.localeCompare(b.peildatum));

    if (!historie.length) return null;

    const latest = historie[historie.length - 1];
    const facts: WozFacts = {
      actueleWaarde: latest.waarde,
      peildatum: latest.peildatum,
      historie,
      trendPctPerJaar: computeTrend(historie),
    };
    cacheSet(cacheKey, "woz", facts, TTL.woz);
    return facts;
  });
}

function computeTrend(historie: WozPoint[]): number | undefined {
  if (historie.length < 2) return undefined;
  const first = historie[0];
  const last = historie[historie.length - 1];
  const years =
    (new Date(last.peildatum).getTime() - new Date(first.peildatum).getTime()) /
    (365.25 * 24 * 60 * 60 * 1000);
  if (years < 0.5 || first.waarde <= 0) return undefined;
  const totalPct = ((last.waarde - first.waarde) / first.waarde) * 100;
  return Math.round((totalPct / years) * 10) / 10;
}

export function wozAdapter(address: ResolvedAddress) {
  return runAdapter("woz", "WOZ-waardeloket", () => fetchWoz(address), {
    attribution: "WOZ-waardeloket / gemeenten",
  });
}
