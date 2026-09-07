import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { PerceelFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

/** PDOK Kadastrale kaart WFS (open data; géén eigendomsinformatie). */
const WFS = "https://service.pdok.nl/kadaster/kadastralekaart/wfs/v5_0";

export async function fetchPerceel(
  address: ResolvedAddress,
): Promise<PerceelFacts | null> {
  const cacheKey = `perceel:${address.nummeraanduidingId}`;
  const cached = cacheGet<PerceelFacts>(cacheKey);
  if (cached) return cached;

  const d = 0.00004; // ~4 m — perceel onder het adrespunt
  const url = new URL(WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", "kadastralekaart:Perceel");
  url.searchParams.set("count", "1");
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("srsName", "EPSG:4326");
  url.searchParams.set(
    "bbox",
    `${address.lat - d},${address.lon - d},${address.lat + d},${address.lon + d},urn:ogc:def:crs:EPSG::4326`,
  );

  const res = await fetchWithTimeout(url.toString(), {}, 10000);
  if (!res.ok) throw new Error(`Kadastrale kaart ${res.status}`);
  const json = (await res.json()) as {
    features?: Array<{ properties?: Record<string, unknown> }>;
  };
  const props = json.features?.[0]?.properties;
  if (!props) return null;

  const gemeente = str(props.kadastraleGemeenteWaarde);
  const sectie = str(props.sectie);
  const nummer = props.perceelnummer != null ? String(props.perceelnummer) : undefined;
  if (!gemeente || !sectie || !nummer) return null;

  const grootte = Number(props.kadastraleGrootteWaarde);
  const facts: PerceelFacts = {
    kadastraleAanduiding: `${gemeente} ${sectie} ${nummer}`,
    grootteM2: Number.isFinite(grootte) && grootte > 0 ? Math.round(grootte) : undefined,
  };
  cacheSet(cacheKey, "perceel", facts, TTL.perceel);
  return facts;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function perceelAdapter(address: ResolvedAddress) {
  return runAdapter("perceel", "Kadastrale kaart", () => fetchPerceel(address), {
    attribution: "Kadaster / PDOK (CC BY 4.0)",
  });
}
