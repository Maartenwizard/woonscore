import { NextRequest, NextResponse } from "next/server";
import { suggestAddresses } from "@/lib/service/report";

export async function GET(req: NextRequest) {
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
