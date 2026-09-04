import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout, parsePoint, rdToWgs84 } from "@/lib/geo";
import type { ResolvedAddress, SuggestItem } from "@/lib/types";
import { runAdapter } from "./runner";

const BASE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

export async function suggestAddresses(q: string): Promise<SuggestItem[]> {
  const query = q.trim();
  if (query.length < 3) return [];
  const cacheKey = `suggest:${query.toLowerCase()}`;
  const cached = cacheGet<SuggestItem[]>(cacheKey);
  if (cached) return cached;

  const url = new URL(`${BASE}/suggest`);
  url.searchParams.set("q", query);
  url.searchParams.set("fq", "type:adres");
  url.searchParams.set("rows", "8");
  url.searchParams.set("fl", "id,weergavenaam,type,score");

  const res = await fetchWithTimeout(url.toString(), {}, 5000);
  if (!res.ok) throw new Error(`Locatieserver suggest ${res.status}`);
  const json = (await res.json()) as {
    response?: { docs?: Array<{ id: string; weergavenaam: string; type: string; score?: number }> };
  };
  const items = (json.response?.docs ?? []).map((d) => ({
    id: d.id,
    weergavenaam: d.weergavenaam,
    type: d.type,
    score: d.score,
  }));
  cacheSet(cacheKey, "locatieserver", items, TTL.geocode);
  return items;
}

export async function lookupAddress(id: string): Promise<ResolvedAddress | null> {
  const cacheKey = `lookup:${id}`;
  const cached = cacheGet<ResolvedAddress>(cacheKey);
  if (cached) return cached;

  const url = new URL(`${BASE}/lookup`);
  url.searchParams.set("id", id);
  url.searchParams.set(
    "fl",
    [
      "id",
      "weergavenaam",
      "straatnaam",
      "huis_nlt",
      "huisnummer",
      "huisletter",
      "huisnummertoevoeging",
      "postcode",
      "woonplaatsnaam",
      "gemeentenaam",
      "gemeentecode",
      "provincienaam",
      "buurtcode",
      "buurtnaam",
      "wijkcode",
      "wijknaam",
      "nummeraanduiding_id",
      "adresseerbaarobject_id",
      "adresseerbaarobject_pand_id",
      "centroide_ll",
      "centroide_rd",
    ].join(","),
  );

  const res = await fetchWithTimeout(url.toString(), {}, 6000);
  if (!res.ok) throw new Error(`Locatieserver lookup ${res.status}`);
  const json = (await res.json()) as { response?: { docs?: Record<string, unknown>[] } };
  const doc = json.response?.docs?.[0];
  if (!doc) return null;

  const ll = parsePoint(String(doc.centroide_ll ?? ""));
  const rd = parsePoint(String(doc.centroide_rd ?? ""));
  let lat = ll?.y;
  let lon = ll?.x;
  if ((lat == null || lon == null) && rd) {
    const wgs = rdToWgs84(rd.x, rd.y);
    lat = wgs.lat;
    lon = wgs.lon;
  }
  if (lat == null || lon == null) return null;

  const huisnummer =
    String(doc.huisnummer ?? doc.huis_nlt ?? "").replace(/[^0-9].*$/, "") ||
    String(doc.huis_nlt ?? "");

  const address: ResolvedAddress = {
    country: "NL",
    weergavenaam: String(doc.weergavenaam ?? ""),
    straatnaam: String(doc.straatnaam ?? ""),
    huisnummer,
    huisletter: doc.huisletter ? String(doc.huisletter) : undefined,
    huisnummertoevoeging: doc.huisnummertoevoeging
      ? String(doc.huisnummertoevoeging)
      : undefined,
    postcode: String(doc.postcode ?? "").replace(/\s/g, ""),
    woonplaatsnaam: String(doc.woonplaatsnaam ?? ""),
    gemeentenaam: String(doc.gemeentenaam ?? ""),
    gemeentecode: doc.gemeentecode ? String(doc.gemeentecode) : undefined,
    provincienaam: doc.provincienaam ? String(doc.provincienaam) : undefined,
    buurtcode: doc.buurtcode ? String(doc.buurtcode) : undefined,
    buurtnaam: doc.buurtnaam ? String(doc.buurtnaam) : undefined,
    wijkcode: doc.wijkcode ? String(doc.wijkcode) : undefined,
    wijknaam: doc.wijknaam ? String(doc.wijknaam) : undefined,
    nummeraanduidingId: String(doc.nummeraanduiding_id ?? id.replace(/^adr-/, "")),
    adresseerbaarObjectId: doc.adresseerbaarobject_id
      ? String(doc.adresseerbaarobject_id)
      : undefined,
    pandId: doc.adresseerbaarobject_pand_id
      ? String(doc.adresseerbaarobject_pand_id).split(";")[0]
      : undefined,
    lat,
    lon,
    rdX: rd?.x,
    rdY: rd?.y,
  };

  cacheSet(cacheKey, "locatieserver", address, TTL.geocode);
  return address;
}

export async function resolveFreeText(q: string): Promise<ResolvedAddress | null> {
  const cacheKey = `free:${q.trim().toLowerCase()}`;
  const cached = cacheGet<ResolvedAddress>(cacheKey);
  if (cached) return cached;

  const url = new URL(`${BASE}/free`);
  url.searchParams.set("q", q);
  url.searchParams.set("fq", "type:adres");
  url.searchParams.set("rows", "1");
  url.searchParams.set("fl", "id");

  const res = await fetchWithTimeout(url.toString(), {}, 6000);
  if (!res.ok) throw new Error(`Locatieserver free ${res.status}`);
  const json = (await res.json()) as { response?: { docs?: Array<{ id: string }> } };
  const id = json.response?.docs?.[0]?.id;
  if (!id) return null;
  const address = await lookupAddress(id);
  if (address) cacheSet(cacheKey, "locatieserver", address, TTL.geocode);
  return address;
}

export async function geocodeAdapter(q: string) {
  return runAdapter("locatieserver", "PDOK Locatieserver", () => resolveFreeText(q), {
    attribution: "Kadaster / PDOK",
  });
}
