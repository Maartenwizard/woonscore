import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { ClimateFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

/**
 * Klimaateffectatlas publieke WMS. Laagnamen geverifieerd via GetCapabilities
 * (zie scripts/check-wms.ts).
 * - Waterdiepte: raster, GRAY_INDEX in meters; -9999 = geen overstroming in scenario.
 * - Paalrot (funderingsrisico): vectorlaag per buurt, property no_cc_risi =
 *   percentage panden met risico op paalrot.
 * - Bodemdaling: vectorlaag, property snelheid in mm/jaar (negatief = daling).
 */
export const KEA_WMS =
  "https://cas.cloud.sogelink.com/public/data/org/gws/YWFMLMWERURF/kea_public/wms";

export const KEA_LAYERS = {
  overstroming: [
    "maximale_waterdiepte_nederland_middelgrote_kans_20260128",
    "maximale_waterdiepte_nederland_middelgrote_kans_20251219",
  ],
  fundering: ["risicopaalrot_huidig"],
  bodemdaling: ["nl_bodemdaling_totaal_v20260623"],
  bodemdalingFallback: ["bodemdaling_2020_2050hoog"],
} as const;

const NODATA_THRESHOLD = -999;

export async function fetchClimateAt(
  address: ResolvedAddress,
): Promise<ClimateFacts | null> {
  const cacheKey = `klimaat:${address.lat.toFixed(4)}:${address.lon.toFixed(4)}`;
  const cached = cacheGet<ClimateFacts>(cacheKey);
  if (cached) return cached;

  const [overstroming, paalrot, bodemdaling, bodemdaling2050] = await Promise.all([
    firstProps(KEA_LAYERS.overstroming, address),
    firstProps(KEA_LAYERS.fundering, address),
    firstProps(KEA_LAYERS.bodemdaling, address),
    firstProps(KEA_LAYERS.bodemdalingFallback, address),
  ]);

  const overstromingsdiepteM = parseWaterdiepte(overstroming);
  const funderingsrisico = parsePaalrot(paalrot);
  const bodemdalingMmJaar = parseBodemdaling(bodemdaling, bodemdaling2050);

  if (
    overstromingsdiepteM == null &&
    funderingsrisico == null &&
    bodemdalingMmJaar == null
  ) {
    return null;
  }

  const facts: ClimateFacts = {
    overstromingsdiepteM,
    funderingsrisico,
    bodemdalingMmJaar,
  };
  cacheSet(cacheKey, "klimaat", facts, TTL.klimaat);
  return facts;
}

export function parseWaterdiepte(props: Record<string, unknown> | null): number | null {
  if (!props) return null;
  const v = Number(props.GRAY_INDEX);
  if (!Number.isFinite(v)) return null;
  // Sentinel (-9999) betekent: valt buiten overstroombaar gebied in dit scenario
  if (v <= NODATA_THRESHOLD) return 0;
  if (v < 0) return 0;
  return Math.round(v * 100) / 100;
}

export function parsePaalrot(props: Record<string, unknown> | null): string | null {
  if (!props) return null;
  const pct = Number(props.no_cc_risi);
  if (!Number.isFinite(pct) || pct < 0) return null;
  const level = pct >= 20 ? "hoog" : pct >= 5 ? "middel" : "laag";
  return `${level} (${Math.round(pct)}% panden met paalrot-risico in buurt)`;
}

export function parseBodemdaling(
  totaal: Record<string, unknown> | null,
  fallback2050: Record<string, unknown> | null,
): number | null {
  const snelheid = Number(totaal?.snelheid);
  if (Number.isFinite(snelheid)) {
    // snelheid in mm/jaar, negatief = daling; we rapporteren daling als positief getal
    return Math.round(Math.abs(snelheid) * 100) / 100;
  }
  const meters2050 = Number(fallback2050?.GRAY_INDEX);
  if (Number.isFinite(meters2050) && meters2050 > NODATA_THRESHOLD) {
    // Verwachte daling 2020-2050 in meters → mm/jaar over 30 jaar
    return Math.round(((Math.abs(meters2050) * 1000) / 30) * 100) / 100;
  }
  return null;
}

async function firstProps(
  layers: readonly string[],
  address: ResolvedAddress,
): Promise<Record<string, unknown> | null> {
  for (const layer of layers) {
    try {
      const props = await wmsGetFeatureInfo(layer, address.lon, address.lat);
      if (props) return props;
    } catch {
      // probeer volgende laag
    }
  }
  return null;
}

async function wmsGetFeatureInfo(
  layer: string,
  lon: number,
  lat: number,
): Promise<Record<string, unknown> | null> {
  const delta = 0.01;
  const url = new URL(KEA_WMS);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.3.0");
  url.searchParams.set("REQUEST", "GetFeatureInfo");
  url.searchParams.set("LAYERS", layer);
  url.searchParams.set("QUERY_LAYERS", layer);
  url.searchParams.set("CRS", "EPSG:4326");
  // WMS 1.3.0 + EPSG:4326 gebruikt lat,lon-asvolgorde
  url.searchParams.set(
    "BBOX",
    `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`,
  );
  url.searchParams.set("WIDTH", "101");
  url.searchParams.set("HEIGHT", "101");
  url.searchParams.set("I", "50");
  url.searchParams.set("J", "50");
  url.searchParams.set("INFO_FORMAT", "application/json");
  url.searchParams.set("FEATURE_COUNT", "1");

  const res = await fetchWithTimeout(url.toString(), {}, 8000);
  if (!res.ok) return null;
  const text = await res.text();
  try {
    const json = JSON.parse(text) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    return json.features?.[0]?.properties ?? null;
  } catch {
    return null;
  }
}

export function klimaatAdapter(address: ResolvedAddress) {
  return runAdapter("klimaat", "Klimaateffectatlas", () => fetchClimateAt(address), {
    attribution: "Klimaateffectatlas (CC BY 4.0)",
  });
}
