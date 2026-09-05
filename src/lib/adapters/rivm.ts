import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { EnvironmentFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

/**
 * RIVM WMS-services. Laagnamen geverifieerd via GetCapabilities (zie scripts/check-wms.ts).
 * - GCN (data.rivm.nl/geo/gcn): grootschalige concentratiekaarten NO2/PM2.5, property per laag.
 * - ALO (data.rivm.nl/geo/alo): geluidkaarten Lden, raster met GRAY_INDEX in dB.
 */
export const RIVM_WMS = {
  gcn: "https://data.rivm.nl/geo/gcn/wms",
  alo: "https://data.rivm.nl/geo/alo/wms",
} as const;

export const RIVM_LAYERS = {
  no2: ["conc_NO2_2025", "gcn_no2"],
  pm25: ["conc_PM25_2025", "gcn_pm25"],
  geluid: [
    "rivm_20220601_Geluid_lden_allebronnen_2020",
    "rivm_20220601_Geluid_lden_wegverkeer_2020",
  ],
} as const;

export async function fetchEnvironment(
  address: ResolvedAddress,
): Promise<EnvironmentFacts | null> {
  const cacheKey = `rivm:${address.lat.toFixed(4)}:${address.lon.toFixed(4)}`;
  const cached = cacheGet<EnvironmentFacts>(cacheKey);
  if (cached) return cached;

  const [no2, pm25, geluid] = await Promise.all([
    firstLayerValue(RIVM_WMS.gcn, RIVM_LAYERS.no2, address),
    firstLayerValue(RIVM_WMS.gcn, RIVM_LAYERS.pm25, address),
    firstLayerValue(RIVM_WMS.alo, RIVM_LAYERS.geluid, address),
  ]);

  const facts: EnvironmentFacts = {
    no2: sanitizeConcentration(no2),
    pm25: sanitizeConcentration(pm25),
    geluidLden: sanitizeLden(geluid),
  };

  if (facts.no2 == null && facts.pm25 == null && facts.geluidLden == null) {
    return null;
  }

  cacheSet(cacheKey, "rivm", facts, TTL.rivm);
  return facts;
}

/** Rasters gebruiken sentinelwaarden (bv. -9999) voor nodata. */
function sanitizeConcentration(v: number | null): number | undefined {
  if (v == null || v < 0 || v > 500) return undefined;
  return v;
}

function sanitizeLden(v: number | null): number | undefined {
  // Lden buiten 20-120 dB is nodata/sentinel
  if (v == null || v < 20 || v > 120) return undefined;
  return v;
}

async function firstLayerValue(
  base: string,
  layers: readonly string[],
  address: ResolvedAddress,
): Promise<number | null> {
  for (const layer of layers) {
    try {
      const val = await wmsGetFeatureInfo(base, layer, address.lon, address.lat);
      if (val != null) return val;
    } catch {
      // probeer volgende laag
    }
  }
  return null;
}

async function wmsGetFeatureInfo(
  base: string,
  layer: string,
  lon: number,
  lat: number,
): Promise<number | null> {
  const delta = 0.01;
  // WMS 1.3.0 + EPSG:4326 gebruikt lat,lon-asvolgorde
  const bbox = `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`;
  const url = new URL(base);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.3.0");
  url.searchParams.set("REQUEST", "GetFeatureInfo");
  url.searchParams.set("LAYERS", layer);
  url.searchParams.set("QUERY_LAYERS", layer);
  url.searchParams.set("CRS", "EPSG:4326");
  url.searchParams.set("BBOX", bbox);
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
    const props = json.features?.[0]?.properties;
    if (!props) return null;
    for (const v of Object.values(props)) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    // GML/plain-text fallback: eerste getal
    const m = /[-+]?\d*\.?\d+/.exec(text);
    if (m) return Number(m[0]);
  }
  return null;
}

export function rivmAdapter(address: ResolvedAddress) {
  return runAdapter("rivm", "RIVM lucht & geluid", () => fetchEnvironment(address), {
    attribution: "RIVM",
  });
}
