import type { SourceMeta } from "@/lib/types";
import { recordAdapterError, recordAdapterOk } from "@/lib/cache";

export interface AdapterResult<T> {
  data: T | null;
  source: SourceMeta;
}

export async function runAdapter<T>(
  sourceId: string,
  label: string,
  fn: () => Promise<T | null>,
  opts?: { attribution?: string; peildatum?: string },
): Promise<AdapterResult<T>> {
  const started = Date.now();
  try {
    const data = await fn();
    const latencyMs = Date.now() - started;
    recordAdapterOk(sourceId, latencyMs);
    if (data == null) {
      return {
        data: null,
        source: {
          id: sourceId,
          label,
          status: "missing",
          fetchedAt: new Date().toISOString(),
          latencyMs,
          attribution: opts?.attribution,
          peildatum: opts?.peildatum,
        },
      };
    }
    return {
      data,
      source: {
        id: sourceId,
        label,
        status: "ok",
        fetchedAt: new Date().toISOString(),
        latencyMs,
        attribution: opts?.attribution,
        peildatum: opts?.peildatum,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    recordAdapterError(sourceId, message, latencyMs);
    return {
      data: null,
      source: {
        id: sourceId,
        label,
        status: "error",
        fetchedAt: new Date().toISOString(),
        error: message,
        latencyMs,
        attribution: opts?.attribution,
      },
    };
  }
}
