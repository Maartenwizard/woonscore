import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/auth";
import { reportFromQuery } from "@/lib/service/report";
import type { ScoreProfile } from "@/lib/types";

export async function POST(req: NextRequest) {
  const auth = checkApiKey(req.headers.get("x-api-key"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { addresses?: string[]; profile?: ScoreProfile };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const addresses = (body.addresses ?? []).map((a) => a.trim()).filter(Boolean);
  if (!addresses.length) {
    return NextResponse.json({ error: "addresses required" }, { status: 400 });
  }
  if (addresses.length > 20) {
    return NextResponse.json({ error: "Max 20 addresses" }, { status: 400 });
  }

  const profile = body.profile ?? "commercial";
  const results = [];

  // Serial to respect WOZ and upstream rate limits
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

  return NextResponse.json({ version: "v1", profile, results });
}
