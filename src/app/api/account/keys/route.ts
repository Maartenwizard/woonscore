import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createKey, listKeys, revokeKey } from "@/lib/api-keys";
import { ensureUser, monthlyUsage, planLimits } from "@/lib/users";

export async function GET() {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = ensureUser(userId);
  const keys = listKeys(userId).map(({ hash: _h, ...rest }) => rest);
  return NextResponse.json({
    keys,
    plan: user.plan,
    limits: planLimits(user.plan),
    usage: monthlyUsage(userId),
    extraCredits: user.extra_credits,
  });
}

export async function POST(req: NextRequest) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let name: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.name === "string") name = body.name.slice(0, 40);
  } catch {
    // geen body is ok
  }
  const result = createKey(userId, name);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  revokeKey(userId, id);
  return NextResponse.json({ ok: true });
}
