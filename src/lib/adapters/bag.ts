import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { BagFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

const BASE = "https://api.pdok.nl/kadaster/bag/ogc/v2";

export async function fetchBag(address: ResolvedAddress): Promise<BagFacts | null> {
  const cacheKey = `bag:${address.nummeraanduidingId}`;
  const cached = cacheGet<BagFacts>(cacheKey);
  if (cached) return cached;

  // Prefer spatial lookup: OGC item IDs are UUIDs, not BAG identificaties.
  const delta = 0.0006;
  const bbox = `${address.lon - delta},${address.lat - delta},${address.lon + delta},${address.lat + delta}`;

  const adresRes = await fetchWithTimeout(
    `${BASE}/collections/adres/items?f=json&limit=200&bbox=${bbox}`,
    { headers: { Accept: "application/geo+json" } },
    10000,
  );
  if (!adresRes.ok) throw new Error(`BAG adres ${adresRes.status}`);
  const adresJson = (await adresRes.json()) as {
    features?: Array<{ properties?: Record<string, unknown> }>;
  };

  const features = adresJson.features ?? [];
  const exact =
    features.find((f) => f.properties?.identificatie === address.nummeraanduidingId) ??
    features.find(
      (f) =>
        String(f.properties?.postcode ?? "").replace(/\s/g, "") === address.postcode &&
        String(f.properties?.huisnummer ?? "") === address.huisnummer &&
        String(f.properties?.status ?? "").includes("uitgegeven"),
    ) ??
    features.find(
      (f) =>
        String(f.properties?.postcode ?? "").replace(/\s/g, "") === address.postcode &&
        String(f.properties?.huisnummer ?? "") === address.huisnummer,
    );

  if (!exact?.properties) return null;

  const vboId = String(
    exact.properties.adresseerbaar_object_identificatie ??
      address.adresseerbaarObjectId ??
      "",
  );

  const vboRes = await fetchWithTimeout(
    `${BASE}/collections/verblijfsobject/items?f=json&limit=200&bbox=${bbox}`,
    { headers: { Accept: "application/geo+json" } },
    10000,
  );
  if (!vboRes.ok) throw new Error(`BAG verblijfsobject ${vboRes.status}`);
  const vboJson = (await vboRes.json()) as {
    features?: Array<{ properties?: Record<string, unknown> }>;
  };
  const vbo = (vboJson.features ?? []).find(
    (f) => String(f.properties?.identificatie ?? "") === vboId,
  );

  const facts: BagFacts = {
    oppervlakte: num(vbo?.properties?.oppervlakte),
    gebruiksdoel: arr(vbo?.properties?.gebruiksdoel),
    status: str(vbo?.properties?.status ?? exact.properties.status),
  };

  const pandHrefs = vbo?.properties?.["pand.href"];
  const href = Array.isArray(pandHrefs) ? String(pandHrefs[0]) : str(pandHrefs);
  if (href) {
    const pandUrl = href.includes("?") ? `${href}&f=json` : `${href}?f=json`;
    const pandRes = await fetchWithTimeout(
      pandUrl,
      { headers: { Accept: "application/geo+json" } },
      8000,
    );
    if (pandRes.ok) {
      const pand = (await pandRes.json()) as { properties?: Record<string, unknown> };
      facts.bouwjaar = num(
        pand.properties?.oorspronkelijk_bouwjaar ??
          pand.properties?.oorspronkelijkBouwjaar ??
          pand.properties?.bouwjaar,
      );
      facts.status = facts.status ?? str(pand.properties?.status);
    }
  }

  if (
    facts.oppervlakte == null &&
    facts.bouwjaar == null &&
    !facts.gebruiksdoel?.length
  ) {
    return null;
  }

  cacheSet(cacheKey, "bag", facts, TTL.bag);
  return facts;
}

export function bagAdapter(address: ResolvedAddress) {
  return runAdapter("bag", "BAG", () => fetchBag(address), {
    attribution: "Kadaster BAG (Public Domain)",
  });
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function str(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}
function arr(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v) return v.split(",").map((s) => s.trim());
  return undefined;
}
