import { bagAdapter } from "@/lib/adapters/bag";
import { bekendmakingenAdapter } from "@/lib/adapters/bekendmakingen";
import { cbsAdapter } from "@/lib/adapters/cbs";
import { energyAdapter } from "@/lib/adapters/eponline";
import { klimaatAdapter } from "@/lib/adapters/klimaat";
import {
  lookupAddress,
  resolveFreeText,
  suggestAddresses,
} from "@/lib/adapters/locatieserver";
import { enrichCrimeWithPopulation, politieAdapter } from "@/lib/adapters/politie";
import { rivmAdapter } from "@/lib/adapters/rivm";
import { scholenAdapter } from "@/lib/adapters/scholen";
import { wozAdapter } from "@/lib/adapters/woz";
import { saveReport } from "@/lib/cache";
import { maybeSummarize } from "@/lib/llm";
import { computeScore } from "@/lib/score/engine";
import type {
  FullReport,
  PropertyFacts,
  ResolvedAddress,
  ScoreProfile,
  SourceMeta,
} from "@/lib/types";

export { suggestAddresses, lookupAddress, resolveFreeText };

export async function buildReport(
  address: ResolvedAddress,
  profile: ScoreProfile = "consumer",
): Promise<FullReport> {
  const results = await Promise.allSettled([
    bagAdapter(address),
    energyAdapter(address),
    wozAdapter(address),
    cbsAdapter(address),
    politieAdapter(address),
    bekendmakingenAdapter(address),
    rivmAdapter(address),
    klimaatAdapter(address),
    scholenAdapter(address),
  ]);

  const sources: SourceMeta[] = [];
  const pick = <T,>(i: number): T | undefined => {
    const r = results[i];
    if (r.status === "fulfilled") {
      sources.push(r.value.source);
      return (r.value.data ?? undefined) as T | undefined;
    }
    sources.push({
      id: `adapter-${i}`,
      label: `Adapter ${i}`,
      status: "error",
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    });
    return undefined;
  };

  const bag = pick<{ bouwjaar?: number; oppervlakte?: number; gebruiksdoel?: string[]; status?: string }>(0);
  const energy = pick<PropertyFacts["energy"]>(1);
  const woz = pick<PropertyFacts["woz"]>(2);
  const cbs = pick<PropertyFacts["cbs"]>(3);
  let crime = pick<PropertyFacts["crime"]>(4);
  const bekendmakingen = pick<PropertyFacts["bekendmakingen"]>(5);
  const environment = pick<PropertyFacts["environment"]>(6);
  const climate = pick<PropertyFacts["climate"]>(7);
  const schools = pick<PropertyFacts["schools"]>(8);

  crime = enrichCrimeWithPopulation(crime ?? null, cbs?.inwoners);

  // Optional LLM summary for bekendmakingen
  if (bekendmakingen && bekendmakingen.items.length && !bekendmakingen.samenvatting) {
    const summary = await maybeSummarizeBekendmakingen(bekendmakingen.items);
    if (summary) bekendmakingen.samenvatting = summary;
  }

  const facts: PropertyFacts = {
    address,
    bag: bag ?? undefined,
    energy: energy ?? undefined,
    woz: woz ?? undefined,
    cbs: cbs ?? undefined,
    crime: crime ?? undefined,
    bekendmakingen: bekendmakingen ?? undefined,
    environment: environment ?? undefined,
    climate: climate ?? undefined,
    schools: schools ?? undefined,
    sources,
  };

  let score = computeScore(facts, profile);
  const narrative = await maybeSummarize(facts, score);
  if (narrative) score = { ...score, summary: narrative };

  const report: FullReport = {
    facts,
    score,
    generatedAt: new Date().toISOString(),
  };

  saveReport(address.nummeraanduidingId, address.weergavenaam, report);
  return report;
}

export async function reportFromQuery(
  opts: {
    address?: string;
    id?: string;
    nummeraanduiding?: string;
    profile?: ScoreProfile;
  },
): Promise<FullReport> {
  let resolved: ResolvedAddress | null = null;
  if (opts.id) {
    resolved = await lookupAddress(opts.id);
  } else if (opts.nummeraanduiding) {
    // Try lookup with adr- prefix variants
    resolved =
      (await lookupAddress(`adr-${opts.nummeraanduiding}`).catch(() => null)) ??
      (await resolveFreeText(opts.nummeraanduiding));
  } else if (opts.address) {
    resolved = await resolveFreeText(opts.address);
  }
  if (!resolved) {
    throw new ReportError(404, "Adres niet gevonden");
  }
  return buildReport(resolved, opts.profile ?? "consumer");
}

export class ReportError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function maybeSummarizeBekendmakingen(
  items: Array<{ titel: string; type?: string }>,
): Promise<string | undefined> {
  const { summarizeBekendmakingen } = await import("@/lib/llm");
  return summarizeBekendmakingen(items);
}
