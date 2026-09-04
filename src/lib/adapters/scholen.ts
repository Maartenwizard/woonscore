import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { getDb } from "@/lib/db";
import { haversineM } from "@/lib/geo";
import type { ResolvedAddress, SchoolsFacts } from "@/lib/types";
import { runAdapter } from "./runner";

export async function fetchSchools(address: ResolvedAddress): Promise<SchoolsFacts | null> {
  const cacheKey = `scholen:${address.lat.toFixed(3)}:${address.lon.toFixed(3)}`;
  const cached = cacheGet<SchoolsFacts>(cacheKey);
  if (cached) return cached;

  const db = getDb();
  const count = (db.prepare(`SELECT COUNT(*) as c FROM scholen`).get() as { c: number }).c;
  if (count === 0) return null;

  // Bounding box ~1.2 km
  const dLat = 0.012;
  const dLon = 0.012 / Math.cos((address.lat * Math.PI) / 180);
  const rows = db
    .prepare(
      `SELECT naam, lat, lon FROM scholen
       WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`,
    )
    .all(address.lat - dLat, address.lat + dLat, address.lon - dLon, address.lon + dLon) as Array<{
    naam: string;
    lat: number;
    lon: number;
  }>;

  const scholen = rows
    .map((r) => ({
      naam: r.naam,
      afstandM: Math.round(haversineM(address.lat, address.lon, r.lat, r.lon)),
    }))
    .filter((s) => s.afstandM <= 1000)
    .sort((a, b) => a.afstandM - b.afstandM)
    .slice(0, 15);

  const facts: SchoolsFacts = {
    binnen1km: scholen.length,
    scholen,
  };
  cacheSet(cacheKey, "scholen", facts, TTL.scholen);
  return facts;
}

export function scholenAdapter(address: ResolvedAddress) {
  return runAdapter("scholen", "DUO scholen", () => fetchSchools(address), {
    attribution: "DUO open onderwijsdata",
  });
}
