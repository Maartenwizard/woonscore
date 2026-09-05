import { renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import { checkSameOrigin } from "@/lib/auth";
import { ReportPdf } from "@/lib/pdf/report-pdf";
import { ReportError, reportFromQuery } from "@/lib/service/report";
import type { ScoreProfile } from "@/lib/types";

export async function GET(req: NextRequest) {
  const origin = checkSameOrigin(req, { allowNavigation: true });
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const sp = req.nextUrl.searchParams;
  const profile = (sp.get("profile") as ScoreProfile) || "commercial";
  let report;
  try {
    report = await reportFromQuery({
      address: sp.get("address") ?? undefined,
      id: sp.get("id") ?? undefined,
      nummeraanduiding: sp.get("nummeraanduiding") ?? undefined,
      profile,
    });
  } catch (e) {
    if (e instanceof ReportError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PDF failed" },
      { status: 502 },
    );
  }

  const buffer = await renderToBuffer(<ReportPdf report={report} />);
  const slug = report.facts.address.weergavenaam
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="woonscore-${slug || "rapport"}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
