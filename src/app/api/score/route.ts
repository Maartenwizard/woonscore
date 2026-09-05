import { NextRequest, NextResponse } from "next/server";
import { checkSameOrigin } from "@/lib/auth";
import { ReportError, reportFromQuery } from "@/lib/service/report";
import type { ScoreProfile } from "@/lib/types";

export async function GET(req: NextRequest) {
  const origin = checkSameOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
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
    return NextResponse.json(report);
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
