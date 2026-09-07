import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout, haversineM } from "@/lib/geo";
import type { ResolvedAddress, SurroundingsFacts } from "@/lib/types";
import { runAdapter } from "./runner";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

interface OsmEl {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function fetchSurroundings(
  address: ResolvedAddress,
): Promise<SurroundingsFacts | null> {
  const cacheKey = `surroundings:${address.lat.toFixed(4)}:${address.lon.toFixed(4)}`;
  const cached = cacheGet<SurroundingsFacts>(cacheKey);
  if (cached) return cached;

  const { lat, lon } = address;
  const query = `
[out:json][timeout:18];
(
  node["highway"="bus_stop"](around:700,${lat},${lon});
  node["railway"="tram_stop"](around:700,${lat},${lon});
  node["station"="subway"](around:700,${lat},${lon});
  node["public_transport"="platform"](around:700,${lat},${lon});
  way["leisure"="park"](around:400,${lat},${lon});
  way["leisure"="garden"](around:400,${lat},${lon});
);
out center 40;
is_in(${lat},${lon})->.a;
rel(pivot.a)["heritage"];
rel(pivot.a)["heritage:operator"="rce"];
out tags;
`.trim();

  let json: { elements?: OsmEl[] } | null = null;
  let lastError = "Overpass onbereikbaar";
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Woonscore/0.1",
          },
          body: `data=${encodeURIComponent(query)}`,
        },
        20000,
      );
      if (!res.ok) {
        lastError = `Overpass ${res.status}`;
        continue;
      }
      json = (await res.json()) as { elements?: OsmEl[] };
      break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  if (!json) throw new Error(lastError);
  const els = json.elements ?? [];

  const stops = els.filter((e) => {
    const t = e.tags ?? {};
    return (
      t.highway === "bus_stop" ||
      t.railway === "tram_stop" ||
      t.station === "subway" ||
      t.public_transport === "platform"
    );
  });
  const parks = els.filter((e) => {
    const t = e.tags ?? {};
    return t.leisure === "park" || t.leisure === "garden";
  });
  const heritage = els.filter(
    (e) =>
      e.type === "relation" &&
      (e.tags?.heritage || e.tags?.["heritage:operator"] === "rce"),
  );

  let afstandOvHalteM: number | undefined;
  let ovHalteNaam: string | undefined;
  let ovHalteType: string | undefined;
  for (const s of stops) {
    const slat = s.lat ?? s.center?.lat;
    const slon = s.lon ?? s.center?.lon;
    if (slat == null || slon == null) continue;
    const d = Math.round(haversineM(lat, lon, slat, slon));
    if (afstandOvHalteM == null || d < afstandOvHalteM) {
      afstandOvHalteM = d;
      ovHalteNaam = s.tags?.name ?? s.tags?.["name:nl"];
      ovHalteType =
        s.tags?.station === "subway"
          ? "metro"
          : s.tags?.railway === "tram_stop"
            ? "tram"
            : "bus";
    }
  }

  let afstandParkM: number | undefined;
  for (const p of parks) {
    const plat = p.lat ?? p.center?.lat;
    const plon = p.lon ?? p.center?.lon;
    if (plat == null || plon == null) continue;
    const d = Math.round(haversineM(lat, lon, plat, plon));
    if (afstandParkM == null || d < afstandParkM) afstandParkM = d;
  }

  const gezicht = heritage.find(
    (h) =>
      /stadsgezicht|dorpsgezicht|beschermd/i.test(h.tags?.name ?? "") ||
      h.tags?.["heritage:operator"] === "rce" ||
      h.tags?.heritage === "1" ||
      h.tags?.heritage === "2",
  );

  const facts: SurroundingsFacts = {
    afstandOvHalteM,
    ovHalteNaam,
    ovHalteType,
    parkenBinnen400m: parks.length || undefined,
    afstandParkM,
    beschermdGezicht: Boolean(gezicht) || undefined,
    beschermdGezichtNaam: gezicht?.tags?.name,
  };

  if (
    facts.afstandOvHalteM == null &&
    facts.afstandParkM == null &&
    !facts.beschermdGezicht
  ) {
    return null;
  }

  cacheSet(cacheKey, "surroundings", facts, TTL.surroundings);
  return facts;
}

export function surroundingsAdapter(address: ResolvedAddress) {
  return runAdapter("surroundings", "Omgeving (OV, groen, gezicht)", () =>
    fetchSurroundings(address),
    { attribution: "OpenStreetMap-bijdragers (ODbL)" },
  );
}
