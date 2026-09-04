import { NextResponse } from "next/server";
import { getAdapterStatuses } from "@/lib/cache";

export async function GET() {
  const rows = getAdapterStatuses();
  return NextResponse.json({
    adapters: rows.map((r) => ({
      id: r.source_id,
      lastOkAt: r.last_ok_at ? new Date(r.last_ok_at).toISOString() : null,
      lastErrorAt: r.last_error_at ? new Date(r.last_error_at).toISOString() : null,
      lastError: r.last_error,
      lastLatencyMs: r.last_latency_ms,
      okCount: r.ok_count,
      errorCount: r.error_count,
      healthy:
        r.last_ok_at != null &&
        (r.last_error_at == null || r.last_ok_at > r.last_error_at),
    })),
  });
}
