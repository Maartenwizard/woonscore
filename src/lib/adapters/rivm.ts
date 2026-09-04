import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { EnvironmentFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

const WMS = "https://geodata.rivm.nl/geoserver/ows";

export async function fetchEnvironment(
  address: ResolvedAddress,
): Promise<EnvironmentFacts | null> {
  const cacheKey = `rivm:${address.lat.toFixed(4)}:${address.lon.toFixed(4)}`;
  const cached = cacheGet<EnvironmentFacts>(cacheKey);
  if (cached) return cached;

  const [no2, pm25, geluid] = await Promise.all([
    getFeatureInfo(["lucht:actueel_no2", "no2", "gcn:conc_no2_2022"]),
    getFeatureInfo(["lucht:actueel_pm25", "pm25", "gcn:conc_pm25_2022"]),
    getFeatureInfo([
      "geluid:geluid_wegverkeer_lden",
      "geluid:lden_wegverkeer",
      "rivm:geluid_weg_lden",
    ]),
  ]);

  const facts: EnvironmentFacts = {
    no2: no2 ?? undefined,
    pm25: pm25 ?? undefined,
    geluidLden: geluid ?? undefined,
  };

  if (facts.no2 == null && facts.pm25 == null && facts.geluidLden == null) {
    return null;
  }

  cacheSet(cacheKey, "rivm", facts, TTL.rivm);
  return facts;

  async function getFeatureInfo(layers: string[]): Promise<number | null> {
    for (const layer of layers) {
      try {
        const val = await wmsGetFeatureInfo(layer, address.lon, address.lat);
        if (val != null) return val;
      } catch {
        // try next layer name
      }
    }
    return null;
  }
}

async function wmsGetFeatureInfo(
  layer: string,
  lon: number,
  lat: number,
): Promise<number | null> {
  const delta = 0.01;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const url = new URL(WMS);
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
    // GML/plain text fallback: first number
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
