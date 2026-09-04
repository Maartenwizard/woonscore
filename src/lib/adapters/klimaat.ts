import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { ClimateFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

const WMS =
  "https://cas.cloud.sogelink.com/public/data/org/gws/YWFMLMWERURF/kea_public/wms";

export async function fetchClimateAt(
  address: ResolvedAddress,
): Promise<ClimateFacts | null> {
  const cacheKey = `klimaat:${address.lat.toFixed(4)}:${address.lon.toFixed(4)}`;
  const cached = cacheGet<ClimateFacts>(cacheKey);
  if (cached) return cached;

  const lon = address.lon;
  const lat = address.lat;

  async function gfi(layer: string): Promise<string | number | null> {
    const delta = 0.02;
    const url = new URL(WMS);
    url.searchParams.set("SERVICE", "WMS");
    url.searchParams.set("VERSION", "1.3.0");
    url.searchParams.set("REQUEST", "GetFeatureInfo");
    url.searchParams.set("LAYERS", layer);
    url.searchParams.set("QUERY_LAYERS", layer);
    url.searchParams.set("CRS", "EPSG:4326");
    // WMS 1.3.0 EPSG:4326 uses lat,lon axis order
    url.searchParams.set(
      "BBOX",
      `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`,
    );
    url.searchParams.set("WIDTH", "101");
    url.searchParams.set("HEIGHT", "101");
    url.searchParams.set("I", "50");
    url.searchParams.set("J", "50");
    url.searchParams.set("INFO_FORMAT", "application/json");

    const res = await fetchWithTimeout(url.toString(), {}, 8000);
    if (!res.ok) return null;
    const text = await res.text();
    try {
      const json = JSON.parse(text) as {
        features?: Array<{ properties?: Record<string, unknown> }>;
      };
      const props = json.features?.[0]?.properties;
      if (!props) return null;
      for (const val of Object.values(props)) {
        if (typeof val === "number") return val;
        if (typeof val === "string" && val.trim()) {
          const n = Number(val);
          return Number.isFinite(n) ? n : val;
        }
      }
    } catch {
      const m =
        /GRAY_INDEX[=:>\s]+([-\d.]+)/i.exec(text) || /([-\d]+\.?\d*)/.exec(text);
      if (m) return Number(m[1]);
    }
    return null;
  }

  const layerSets = {
    overstroming: [
      "overstromingsdiepte",
      "Overstromingsdiepte",
      "overstromingsdiepte_middelgroot",
    ],
    fundering: ["funderingsrisico", "risicokaart_fundering", "Funderingsrisico"],
    bodemdaling: ["bodemdaling", "bodemdalingsvoorspelling", "Bodemdaling"],
  };

  let overstromingsdiepteM: number | null = null;
  let funderingsrisico: string | null = null;
  let bodemdalingMmJaar: number | null = null;

  for (const layer of layerSets.overstroming) {
    const v = await gfi(layer);
    if (typeof v === "number") {
      overstromingsdiepteM = v;
      break;
    }
  }
  for (const layer of layerSets.fundering) {
    const v = await gfi(layer);
    if (v != null) {
      funderingsrisico = String(v);
      break;
    }
  }
  for (const layer of layerSets.bodemdaling) {
    const v = await gfi(layer);
    if (typeof v === "number") {
      bodemdalingMmJaar = v;
      break;
    }
  }

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

export function klimaatAdapter(address: ResolvedAddress) {
  return runAdapter("klimaat", "Klimaateffectatlas", () => fetchClimateAt(address), {
    attribution: "Klimaateffectatlas, 2026 (CC BY 4.0)",
  });
}
