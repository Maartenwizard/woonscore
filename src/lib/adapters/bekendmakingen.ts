import { XMLParser } from "fast-xml-parser";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { Bekendmaking, BekendmakingenFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

const SRU = "https://repository.overheid.nl/sru";

export async function fetchBekendmakingen(
  address: ResolvedAddress,
): Promise<BekendmakingenFacts | null> {
  const pc4 = address.postcode.slice(0, 4);
  if (!/^\d{4}$/.test(pc4)) return null;

  const cacheKey = `bekend:${pc4}:${address.gemeentenaam}`;
  const cached = cacheGet<BekendmakingenFacts>(cacheKey);
  if (cached) return cached;

  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  const fromStr = from.toISOString().slice(0, 10);

  // CQL: official publications near postcode / municipality
  const query = [
    `c.product-area=="officielepublicaties"`,
    `dt.modified>=${fromStr}`,
    `(postcodeCijfers=${pc4} OR dt.creator=="${escapeCql(address.gemeentenaam)}")`,
  ].join(" AND ");

  const url = new URL(SRU);
  url.searchParams.set("operation", "searchRetrieve");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("query", query);
  url.searchParams.set("maximumRecords", "20");
  url.searchParams.set("recordSchema", "gzd");

  const res = await fetchWithTimeout(url.toString(), {}, 12000);
  if (!res.ok) throw new Error(`SRU bekendmakingen ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
  });
  const doc = parser.parse(xml);
  const search = doc?.searchRetrieveResponse ?? doc;
  const numberOfRecords = Number(search?.numberOfRecords ?? 0);
  const records = normalizeArray(search?.records?.record);

  const items: Bekendmaking[] = [];
  for (const rec of records) {
    const meta =
      rec?.recordData?.gzd?.originalData?.meta ??
      rec?.recordData?.meta ??
      rec?.recordData ??
      {};
    const owms = meta?.owmskern ?? meta?.owms ?? meta;
    const titel = str(owms?.title ?? owms?.identifier) ?? "Bekendmaking";
    const datum = str(owms?.modified ?? owms?.date);
    const type = str(meta?.oep?.publicatienaam ?? owms?.type);
    const urlVal = str(owms?.identifier);
    items.push({ titel, datum, type, url: urlVal });
  }

  const facts: BekendmakingenFacts = {
    count12m: numberOfRecords || items.length,
    items: items.slice(0, 10),
  };
  cacheSet(cacheKey, "bekendmakingen", facts, TTL.bekendmakingen);
  return facts;
}

export function bekendmakingenAdapter(address: ResolvedAddress) {
  return runAdapter(
    "bekendmakingen",
    "Officiële bekendmakingen",
    () => fetchBekendmakingen(address),
    { attribution: "KOOP / overheid.nl" },
  );
}

function escapeCql(s: string): string {
  return s.replace(/"/g, '\\"');
}
function normalizeArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "object" && "#text" in (v as object)) {
    return String((v as { "#text": unknown })["#text"]);
  }
  return String(v);
}
