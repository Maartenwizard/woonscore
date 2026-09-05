import type { RiskItem, ScoreProfile } from "@/lib/types";
import { reportFromQuery } from "./report";

export const BULK_MAX = 20;

export interface BulkRow {
  address: string;
  ok: boolean;
  total?: number | null;
  weergavenaam?: string;
  nummeraanduidingId?: string;
  risks?: RiskItem[];
  error?: string;
}

/** Serieel om WOZ- en upstream-limieten te respecteren. */
export async function bulkScore(
  addresses: string[],
  profile: ScoreProfile,
): Promise<BulkRow[]> {
  const results: BulkRow[] = [];
  for (const address of addresses) {
    try {
      const report = await reportFromQuery({ address, profile });
      results.push({
        address,
        ok: true,
        total: report.score.total,
        weergavenaam: report.facts.address.weergavenaam,
        nummeraanduidingId: report.facts.address.nummeraanduidingId,
        risks: report.score.risks,
      });
    } catch (e) {
      results.push({
        address,
        ok: false,
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }
  return results;
}

export function parseBulkAddresses(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim())
    .filter(Boolean);
}
