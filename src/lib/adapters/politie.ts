import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { CrimeFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

const TABLE = "47018NED";
const BASE = `https://dataderden.cbs.nl/ODataApi/OData/${TABLE}`;

/** Rough NL average registered crimes per 1000 inhabitants. */
const LAND_AVG_PER_1000 = 45;

export async function fetchCrime(address: ResolvedAddress): Promise<CrimeFacts | null> {
  const codes = [address.buurtcode, address.wijkcode, address.gemeentecode]
    .filter(Boolean)
    .map((c) => String(c).replace(/\s/g, ""));

  for (const code of codes) {
    const cacheKey = `crime:v2:${code}`;
    const cached = cacheGet<CrimeFacts>(cacheKey);
    if (cached) return cached;

    try {
      const facts = await queryCrime(code);
      if (facts) {
        cacheSet(cacheKey, "politie", facts, TTL.politie);
        return facts;
      }
    } catch {
      // try next geographic level
    }
  }
  return null;
}

async function queryCrime(code: string): Promise<CrimeFacts | null> {
  const filter = encodeURIComponent(
    `startswith(WijkenEnBuurten,'${code}') and startswith(SoortMisdrijf,'0.0.0')`,
  );
  const url = `${BASE}/TypedDataSet?$filter=${filter}&$top=30&$orderby=Perioden desc`;
  const res = await fetchWithTimeout(url, {}, 12000);
  if (!res.ok) throw new Error(`Politie OData ${res.status}`);
  const json = (await res.json()) as { value?: Array<Record<string, unknown>> };
  const rows = json.value ?? [];
  if (!rows.length) return null;

  // Prefer most recent complete-ish year (skip sparse current year if 0)
  const sorted = [...rows].sort((a, b) =>
    String(b.Perioden).localeCompare(String(a.Perioden)),
  );
  const totalRow =
    sorted.find((r) => Number(r.GeregistreerdeMisdrijven_1) > 0) ?? sorted[0];

  const misdrijvenTotaal = num(totalRow.GeregistreerdeMisdrijven_1);
  const peiljaar = str(totalRow.Perioden)?.slice(0, 4) ?? "2024";

  const types = await queryCrimeTypes(code, peiljaar);

  return {
    misdrijvenTotaal,
    landelijkGemiddeldePer1000: LAND_AVG_PER_1000,
    peiljaar,
    ...types,
  };
}

async function queryCrimeTypes(
  code: string,
  peiljaar: string,
): Promise<Pick<CrimeFacts, "inbraakWoning" | "fietsendiefstal" | "mishandeling">> {
  const filter = encodeURIComponent(
    `startswith(WijkenEnBuurten,'${code}') and startswith(Perioden,'${peiljaar}') and (startswith(SoortMisdrijf,'1.1.1') or startswith(SoortMisdrijf,'1.2.3') or startswith(SoortMisdrijf,'1.4.5'))`,
  );
  try {
    const res = await fetchWithTimeout(
      `${BASE}/TypedDataSet?$filter=${filter}&$top=20`,
      {},
      10000,
    );
    if (!res.ok) return {};
    const json = (await res.json()) as { value?: Array<Record<string, unknown>> };
    const out: Pick<CrimeFacts, "inbraakWoning" | "fietsendiefstal" | "mishandeling"> = {};
    for (const r of json.value ?? []) {
      const soort = String(r.SoortMisdrijf ?? "");
      const n = num(r.GeregistreerdeMisdrijven_1);
      if (n == null) continue;
      if (soort.startsWith("1.1.1")) out.inbraakWoning = n;
      else if (soort.startsWith("1.2.3")) out.fietsendiefstal = n;
      else if (soort.startsWith("1.4.5")) out.mishandeling = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function enrichCrimeWithPopulation(
  crime: CrimeFacts | null | undefined,
  inwoners?: number,
): CrimeFacts | undefined {
  if (!crime) return undefined;
  if (crime.misdrijvenTotaal != null && inwoners && inwoners > 0) {
    const per1000 = (crime.misdrijvenTotaal / inwoners) * 1000;
    const land = crime.landelijkGemiddeldePer1000 ?? LAND_AVG_PER_1000;
    return {
      ...crime,
      misdrijvenPer1000: Math.round(per1000 * 10) / 10,
      pctVsLandelijk: Math.round(((per1000 - land) / land) * 100),
    };
  }
  return crime;
}

export function politieAdapter(address: ResolvedAddress) {
  return runAdapter("politie", "Politie open data", () => fetchCrime(address), {
    attribution: "Politie / CBS (CC BY 4.0)",
  });
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function str(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}
