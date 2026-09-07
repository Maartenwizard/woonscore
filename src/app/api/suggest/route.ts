import { NextRequest, NextResponse } from "next/server";
import { checkSameOrigin } from "@/lib/auth";
import { suggestAddresses } from "@/lib/service/report";

export async function GET(req: NextRequest) {
  const origin = checkSameOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const items = await suggestAddresses(q);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Suggest failed" },
      { status: 502 },
    );
  }
}
