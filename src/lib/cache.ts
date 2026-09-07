import { getDb } from "./db";

export const TTL = {
  bag: 7 * 24 * 60 * 60,
  energy: 7 * 24 * 60 * 60,
  woz: 30 * 24 * 60 * 60,
  cbs: 30 * 24 * 60 * 60,
  politie: 30 * 24 * 60 * 60,
  bekendmakingen: 24 * 60 * 60,
  rivm: 30 * 24 * 60 * 60,
  klimaat: 30 * 24 * 60 * 60,
  scholen: 30 * 24 * 60 * 60,
  geocode: 7 * 24 * 60 * 60,
  report: 24 * 60 * 60,
  perceel: 30 * 24 * 60 * 60,
  monument: 30 * 24 * 60 * 60,
  markt: 7 * 24 * 60 * 60,
  surroundings: 30 * 24 * 60 * 60,
} as const;

export function cacheGet<T>(key: string): T | null {
  const row = getDb()
    .prepare(
      `SELECT payload, expires_at FROM cache WHERE cache_key = ? AND expires_at > ?`,
    )
    .get(key, Date.now()) as { payload: string; expires_at: number } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

export function cacheSet(
  key: string,
  sourceId: string,
  value: unknown,
  ttlSeconds: number,
): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO cache (cache_key, source_id, payload, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         source_id = excluded.source_id,
         payload = excluded.payload,
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at`,
    )
    .run(key, sourceId, JSON.stringify(value), now, now + ttlSeconds * 1000);
}

export function recordAdapterOk(sourceId: string, latencyMs: number): void {
  getDb()
    .prepare(
      `INSERT INTO adapter_status (source_id, last_ok_at, last_latency_ms, ok_count, error_count)
       VALUES (?, ?, ?, 1, 0)
       ON CONFLICT(source_id) DO UPDATE SET
         last_ok_at = excluded.last_ok_at,
         last_latency_ms = excluded.last_latency_ms,
         ok_count = ok_count + 1`,
    )
    .run(sourceId, Date.now(), latencyMs);
}

export function recordAdapterError(sourceId: string, error: string, latencyMs: number): void {
  getDb()
    .prepare(
      `INSERT INTO adapter_status (source_id, last_error_at, last_error, last_latency_ms, ok_count, error_count)
       VALUES (?, ?, ?, ?, 0, 1)
       ON CONFLICT(source_id) DO UPDATE SET
         last_error_at = excluded.last_error_at,
         last_error = excluded.last_error,
         last_latency_ms = excluded.last_latency_ms,
         error_count = error_count + 1`,
    )
    .run(sourceId, Date.now(), error.slice(0, 500), latencyMs);
}

export function getAdapterStatuses() {
  return getDb()
    .prepare(`SELECT * FROM adapter_status ORDER BY source_id`)
    .all() as Array<{
    source_id: string;
    last_ok_at: number | null;
    last_error_at: number | null;
    last_error: string | null;
    last_latency_ms: number | null;
    ok_count: number;
    error_count: number;
  }>;
}

export function saveReport(nummeraanduidingId: string, weergavenaam: string, payload: unknown) {
  getDb()
    .prepare(
      `INSERT INTO reports (nummeraanduiding_id, weergavenaam, payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(nummeraanduiding_id) DO UPDATE SET
         weergavenaam = excluded.weergavenaam,
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
    )
    .run(nummeraanduidingId, weergavenaam, JSON.stringify(payload), Date.now());
}

/** Bewaar één scorepunt per adres per dag voor het scoreverloop. */
export function saveReportHistory(nummeraanduidingId: string, total: number | null) {
  const date = new Date().toISOString().slice(0, 10);
  getDb()
    .prepare(
      `INSERT INTO report_history (nummeraanduiding_id, date, total, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(nummeraanduiding_id, date) DO UPDATE SET
         total = excluded.total,
         created_at = excluded.created_at`,
    )
    .run(nummeraanduidingId, date, total, Date.now());
}

export function loadReportHistory(
  nummeraanduidingId: string,
  limit = 30,
): Array<{ date: string; total: number | null }> {
  return getDb()
    .prepare(
      `SELECT date, total FROM report_history
       WHERE nummeraanduiding_id = ?
       ORDER BY date DESC LIMIT ?`,
    )
    .all(nummeraanduidingId, limit)
    .reverse() as Array<{ date: string; total: number | null }>;
}

export function loadReport(nummeraanduidingId: string) {
  const row = getDb()
    .prepare(`SELECT payload, updated_at FROM reports WHERE nummeraanduiding_id = ?`)
    .get(nummeraanduidingId) as { payload: string; updated_at: number } | undefined;
  if (!row) return null;
  return { report: JSON.parse(row.payload), updatedAt: row.updated_at };
}
