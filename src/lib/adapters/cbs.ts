import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { CbsFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

/** CBS Wijken en Buurten kerncijfers — table id may change yearly. */
const CBS_TABLE = "85984NED";
const CBS_BASE = `https://opendata.cbs.nl/ODataApi/odata/${CBS_TABLE}`;

export async function fetchCbs(address: ResolvedAddress): Promise<CbsFacts | null> {
  const code = normalizeBuurt(address.buurtcode);
  if (!code) return null;

  const cacheKey = `cbs:v2:${code}`;
  const cached = cacheGet<CbsFacts>(cacheKey);
  if (cached) return cached;

  // TypedDataSet filter on WijkenEnBuurten
  const filter = encodeURIComponent(`startswith(WijkenEnBuurten,'${code}')`);
  const url = `${CBS_BASE}/TypedDataSet?$filter=${filter}&$top=5`;

  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 10000);
  if (!res.ok) {
    // Fallback: try without TypedDataSet path via Observations-style
    return fetchCbsFallback(code);
  }

  const json = (await res.json()) as { value?: Array<Record<string, unknown>> };
  const row = json.value?.[0];
  if (!row) return fetchCbsFallback(code);

  const facts = mapCbsRow(row);
  cacheSet(cacheKey, "cbs", facts, TTL.cbs);
  return facts;
}

async function fetchCbsFallback(code: string): Promise<CbsFacts | null> {
  // Older StatLine v3 style
  const url = `https://opendata.cbs.nl/ODataApi/OData/${CBS_TABLE}/TypedDataSet?$filter=${encodeURIComponent(
    `WijkenEnBuurten eq '${code}'`,
  )}`;
  const res = await fetchWithTimeout(url, {}, 10000);
  if (!res.ok) throw new Error(`CBS ${res.status}`);
  const json = (await res.json()) as { value?: Array<Record<string, unknown>> };
  const row = json.value?.[0];
  if (!row) return null;
  const facts = mapCbsRow(row);
  cacheSet(`cbs:v2:${code}`, "cbs", facts, TTL.cbs);
  return facts;
}

export function mapCbsRow(row: Record<string, unknown>): CbsFacts {
  const wozDuizend = num(row.GemiddeldeWOZWaardeVanWoningen_39);
  return {
    inwoners: num(row.AantalInwoners_5 ?? row.AantalInwoners),
    huishoudens: num(row.HuishoudensTotaal_28 ?? row.HuishoudensTotaal),
    gemiddeldInkomen: num(
      row.GemiddeldInkomenPerInwoner_78 ??
        row.GemiddeldInkomenPerInwoner_72 ??
        row.GemiddeldBesteedbaarInkomenPerHuishouden_75 ??
        row.GemiddeldInkomen,
    ),
    gemiddeldeWoz: wozDuizend != null ? wozDuizend * 1000 : undefined,
    afstandSupermarktKm: num(
      row.AfstandTotGroteSupermarkt_111 ??
        row.AfstandTotGroteSupermarkt_105 ??
        row.AfstandTotSupermarkt,
    ),
    afstandHuisartsKm: num(
      row.AfstandTotHuisartsenpraktijk_110 ??
        row.AfstandTotHuisartsenpraktijk_98 ??
        row.AfstandTotHuisarts,
    ),
    afstandStationKm: num(row.AfstandTotTreinstationsTotaal_111 ?? row.AfstandTotStation),
    afstandBasisschoolKm: num(
      row.AfstandTotSchool_113 ?? row.AfstandTotSchool_108 ?? row.AfstandTotBasisonderwijs,
    ),
    afstandKinderopvangKm: num(row.AfstandTotKinderdagverblijf_112),
  };
}

function normalizeBuurt(code?: string): string | null {
  if (!code) return null;
  // Locatieserver often returns BU0363xx; CBS may want padded codes
  return code.replace(/\s/g, "");
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function cbsAdapter(address: ResolvedAddress) {
  return runAdapter("cbs", "CBS Wijken en Buurten", () => fetchCbs(address), {
    attribution: "CBS StatLine",
  });
}
