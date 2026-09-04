import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/geo";
import type { EnergyFacts, ResolvedAddress } from "@/lib/types";
import { runAdapter } from "./runner";

export async function fetchEnergy(address: ResolvedAddress): Promise<EnergyFacts | null> {
  const apiKey = process.env.EP_ONLINE_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `energy:${address.postcode}:${address.huisnummer}:${address.huisletter ?? ""}:${address.huisnummertoevoeging ?? ""}`;
  const cached = cacheGet<EnergyFacts>(cacheKey);
  if (cached) return cached;

  const url = new URL("https://public.ep-online.nl/api/v5/PandEnergielabel/Adres");
  url.searchParams.set("postcode", address.postcode);
  url.searchParams.set("huisnummer", address.huisnummer);
  if (address.huisletter) url.searchParams.set("huisletter", address.huisletter);
  if (address.huisnummertoevoeging) {
    url.searchParams.set("huisnummertoevoeging", address.huisnummertoevoeging);
  }

  const res = await fetchWithTimeout(
    url.toString(),
    {
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
      },
    },
    8000,
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`EP-Online ${res.status}`);

  const json = (await res.json()) as Record<string, unknown> | Record<string, unknown>[];
  const item = Array.isArray(json) ? json[0] : json;
  if (!item) return null;

  const facts: EnergyFacts = {
    labelklasse: str(
      item.Energieklasse ?? item.energieklasse ?? item.Labelklasse ?? item.labelklasse,
    ),
    energieIndex: num(item.EnergieIndex ?? item.energieIndex),
    registratiedatum: str(
      item.Registratiedatum ?? item.registratiedatum ?? item.Afmelddatum,
    ),
    gebouwtype: str(item.Gebouwtype ?? item.gebouwtype ?? item.Gebouwklasse),
  };

  cacheSet(cacheKey, "energy", facts, TTL.energy);
  return facts;
}

export function energyAdapter(address: ResolvedAddress) {
  if (!process.env.EP_ONLINE_API_KEY) {
    return Promise.resolve({
      data: null as EnergyFacts | null,
      source: {
        id: "energy",
        label: "EP-Online",
        status: "skipped" as const,
        error: "EP_ONLINE_API_KEY ontbreekt",
        attribution: "RVO EP-Online",
      },
    });
  }
  return runAdapter("energy", "EP-Online", () => fetchEnergy(address), {
    attribution: "RVO EP-Online",
  });
}

function str(v: unknown): string | undefined {
  return v == null || v === "" ? undefined : String(v);
}
function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
