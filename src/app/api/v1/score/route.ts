import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/auth";
import { ReportError, reportFromQuery } from "@/lib/service/report";
import type { ScoreProfile } from "@/lib/types";

export async function GET(req: NextRequest) {
  const auth = checkApiKey(req.headers.get("x-api-key"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sp = req.nextUrl.searchParams;
  const profile = (sp.get("profile") as ScoreProfile) || "consumer";

  try {
    const report = await reportFromQuery({
      address: sp.get("address") ?? undefined,
      id: sp.get("id") ?? undefined,
      nummeraanduiding: sp.get("nummeraanduiding") ?? undefined,
      profile,
    });
    return NextResponse.json({
      version: "v1",
      profile,
      address: report.facts.address,
      total: report.score.total,
      partials: report.score.partials,
      positives: report.score.positives,
      negatives: report.score.negatives,
      sources: report.facts.sources,
      generatedAt: report.generatedAt,
      disclaimer: report.score.disclaimer,
    });
  } catch (e) {
    if (e instanceof ReportError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Score failed" },
      { status: 502 },
    );
  }
}
