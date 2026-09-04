import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/auth";
import { suggestAddresses, resolveFreeText } from "@/lib/service/report";

export async function GET(req: NextRequest) {
  const auth = checkApiKey(req.headers.get("x-api-key"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const lookup = req.nextUrl.searchParams.get("lookup") === "1";

  try {
    if (lookup) {
      const address = await resolveFreeText(q);
      if (!address) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ address });
    }
    const items = await suggestAddresses(q);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Geocode failed" },
      { status: 502 },
    );
  }
}
