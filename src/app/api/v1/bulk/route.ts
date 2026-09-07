import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/auth";
import { BULK_MAX, bulkScore, parseBulkAddresses } from "@/lib/service/bulk";
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

  const addresses = parseBulkAddresses(body.addresses);
  if (!addresses.length) {
    return NextResponse.json({ error: "addresses required" }, { status: 400 });
  }
  const max = auth.bulkMax ?? BULK_MAX;
  if (addresses.length > max) {
    return NextResponse.json({ error: `Max ${max} addresses` }, { status: 400 });
  }

  const profile = body.profile ?? "commercial";
  const results = await bulkScore(addresses, profile);

  return NextResponse.json({ version: "v1", profile, results });
}
