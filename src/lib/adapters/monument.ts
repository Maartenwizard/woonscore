import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout, haversineM } from "@/lib/geo";
import type { MonumentFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

/** RCE open data: rijksmonumentpunten (CC0/CC-BY). */
const WFS = "https://data.geo.cultureelerfgoed.nl/openbaar/wfs";

/** Punt binnen deze afstand van het adres → indicatie dat het pand zelf monument is. */
const MATCH_M = 15;
/** Dichtheid binnen deze straal als context (bv. historische binnenstad). */
const DENSITY_M = 75;

interface MonumentPoint {
  nummer?: number;
  categorie?: string;
  url?: string;
  afstandM: number;
}

export async function fetchMonument(
  address: ResolvedAddress,
): Promise<MonumentFacts | null> {
  const cacheKey = `monument:${address.lat.toFixed(5)}:${address.lon.toFixed(5)}`;
  const cached = cacheGet<MonumentFacts>(cacheKey);
  if (cached) return cached;

  // bbox ~±90 m
  const dLat = 0.0009;
  const dLon = 0.0009 / Math.cos((address.lat * Math.PI) / 180);
  const url = new URL(WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", "openbaar:rijksmonumentpunten");
  url.searchParams.set("count", "100");
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("srsName", "EPSG:4326");
  url.searchParams.set(
    "bbox",
    `${address.lat - dLat},${address.lon - dLon},${address.lat + dLat},${address.lon + dLon},urn:ogc:def:crs:EPSG::4326`,
  );

  const res = await fetchWithTimeout(url.toString(), {}, 10000);
  if (!res.ok) throw new Error(`RCE monumenten ${res.status}`);
  const json = (await res.json()) as {
    features?: Array<{
      geometry?: { type?: string; coordinates?: [number, number] };
      properties?: Record<string, unknown>;
    }>;
  };

  const points: MonumentPoint[] = (json.features ?? [])
    .filter(
      (f) =>
        f.geometry?.type === "Point" &&
        Array.isArray(f.geometry.coordinates) &&
        f.properties?.juridische_status === "rijksmonument",
    )
    .map((f) => {
      const [lon, lat] = f.geometry!.coordinates!;
      return {
        nummer: num(f.properties!.rijksmonument_nummer),
        categorie:
          typeof f.properties!.hoofdcategorie === "string"
            ? f.properties!.hoofdcategorie
            : undefined,
        url:
          typeof f.properties!.rijksmonumenturl === "string"
            ? f.properties!.rijksmonumenturl
            : undefined,
        afstandM: haversineM(address.lat, address.lon, lat, lon),
      };
    })
    .sort((a, b) => a.afstandM - b.afstandM);

  const nearest = points[0];
  const match = nearest && nearest.afstandM <= MATCH_M ? nearest : undefined;
  const facts: MonumentFacts = {
    isRijksmonument: Boolean(match),
    rijksmonumentNummer: match?.nummer,
    categorie: match?.categorie,
    monumentUrl: match?.url,
    aantalBinnen75m: points.filter((p) => p.afstandM <= DENSITY_M).length,
  };

  cacheSet(cacheKey, "monument", facts, TTL.monument);
  return facts;
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function monumentAdapter(address: ResolvedAddress) {
  return runAdapter("monument", "Rijksmonumentenregister", () => fetchMonument(address), {
    attribution: "Rijksdienst voor het Cultureel Erfgoed",
  });
}
