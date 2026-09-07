import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { MarketFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

/** CBS/Kadaster prijsindex bestaande koopwoningen (2020=100), G4 + landsdelen + provincies. */
const TABLE = "85792NED";
const BASE = `https://opendata.cbs.nl/ODataApi/odata/${TABLE}`;

const G4: Record<string, string> = {
  amsterdam: "GM0363",
  rotterdam: "GM0599",
  utrecht: "GM0344",
  "'s-gravenhage": "GM0518",
  "den haag": "GM0518",
  "'s gravenhage": "GM0518",
};

const PROVINCE: Record<string, string> = {
  groningen: "PV20",
  "fryslân": "PV21",
  friesland: "PV21",
  drenthe: "PV22",
  overijssel: "PV23",
  flevoland: "PV24",
  gelderland: "PV25",
  utrecht: "PV26",
  "noord-holland": "PV27",
  "zuid-holland": "PV28",
  zeeland: "PV29",
  "noord-brabant": "PV30",
  limburg: "PV31",
};

function regioCodes(address: ResolvedAddress): Array<{ code: string; label: string }> {
  const out: Array<{ code: string; label: string }> = [];
  const gem = (address.gemeentenaam ?? "").toLowerCase();
  if (G4[gem]) out.push({ code: G4[gem], label: address.gemeentenaam });
  const prov = (address.provincienaam ?? "").toLowerCase();
  if (PROVINCE[prov]) out.push({ code: PROVINCE[prov], label: address.provincienaam ?? prov });
  out.push({ code: "NL01", label: "Nederland" });
  return out;
}

export async function fetchMarket(address: ResolvedAddress): Promise<MarketFacts | null> {
  const cacheKey = `markt:v2:${address.gemeentecode ?? address.gemeentenaam ?? "nl"}`;
  const cached = cacheGet<MarketFacts>(cacheKey);
  if (cached) return cached;

  for (const regio of regioCodes(address)) {
    const filter = encodeURIComponent(
      `RegioS eq '${regio.code}' and startswith(Perioden,'202')`,
    );
    const url = `${BASE}/TypedDataSet?$filter=${filter}&$top=80`;
    const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 10000);
    if (!res.ok) continue;
    const json = (await res.json()) as { value?: Array<Record<string, unknown>> };
    const rows = [...(json.value ?? [])].sort((a, b) =>
      String(b.Perioden).localeCompare(String(a.Perioden)),
    );
    const row = rows.find(
      (r) =>
        String(r.Perioden).includes("KW") &&
        (Number.isFinite(Number(r.OntwikkelingTOVEenJaarEerder_3)) ||
          Number.isFinite(Number(r.PrijsindexVerkoopprijzen_1))),
    );
    if (!row) continue;

    const facts: MarketFacts = {
      prijsindexYoY: num(row.OntwikkelingTOVEenJaarEerder_3),
      gemiddeldeVerkoopprijs: num(row.GemiddeldeVerkoopprijs_7),
      verkochteWoningen: num(row.VerkochteWoningen_4),
      verkochtYoY: num(row.OntwikkelingTOVEenJaarEerder_6),
      peilperiode: String(row.Perioden ?? ""),
      regio: regio.label,
    };
    cacheSet(cacheKey, "markt", facts, TTL.markt);
    return facts;
  }
  return null;
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function marktAdapter(address: ResolvedAddress) {
  return runAdapter("markt", "CBS prijsindex koopwoningen", () => fetchMarket(address), {
    attribution: "CBS / Kadaster PBK",
  });
}
