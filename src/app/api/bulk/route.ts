import { NextRequest, NextResponse } from "next/server";
import { checkSameOrigin } from "@/lib/auth";
import { BULK_MAX, bulkScore, parseBulkAddresses } from "@/lib/service/bulk";
import type { ScoreProfile } from "@/lib/types";

/** Interne bulk-endpoint voor de eigen frontend (geen API-key nodig). */
export async function POST(req: NextRequest) {
  const origin = checkSameOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  let body: { addresses?: string[]; profile?: ScoreProfile };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const addresses = parseBulkAddresses(body.addresses).slice(0, BULK_MAX);
  if (!addresses.length) {
    return NextResponse.json({ error: "addresses required" }, { status: 400 });
  }

  const profile = body.profile ?? "commercial";
  const results = await bulkScore(addresses, profile);

  return NextResponse.json({ profile, results });
}
