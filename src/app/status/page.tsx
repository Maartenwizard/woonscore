"use client";

import { useEffect, useState } from "react";
import { Disclaimer, Nav } from "@/components/Nav";

type Adapter = {
  id: string;
  healthy: boolean;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  okCount: number;
  errorCount: number;
};

export default function StatusPage() {
  const [adapters, setAdapters] = useState<Adapter[]>([]);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setAdapters(j.adapters ?? []))
      .catch(() => setAdapters([]));
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="status" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">Status</h1>
        <p className="mb-8 text-[var(--muted)]">
          Gezondheid per databron-adapter (uit SQLite-logs).
        </p>
        {adapters.length === 0 ? (
          <p className="text-[var(--muted)]">
            Nog geen bevragingen gelogd. Zoek eerst een adres.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Adapter</th>
                  <th className="px-3 py-2">Gezond</th>
                  <th className="px-3 py-2">Latency</th>
                  <th className="px-3 py-2">OK / fout</th>
                  <th className="px-3 py-2">Laatste fout</th>
                </tr>
              </thead>
              <tbody>
                {adapters.map((a) => (
                  <tr key={a.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">{a.id}</td>
                    <td className="px-3 py-2">{a.healthy ? "ja" : "nee"}</td>
                    <td className="px-3 py-2">
                      {a.lastLatencyMs != null ? `${a.lastLatencyMs} ms` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {a.okCount} / {a.errorCount}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-[var(--muted)]">
                      {a.lastError ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8">
        <Disclaimer />
      </footer>
    </div>
  );
}
