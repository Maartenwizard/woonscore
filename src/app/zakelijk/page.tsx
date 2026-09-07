"use client";

import { useState } from "react";
import { AddressSearch } from "@/components/AddressSearch";
import { Disclaimer, Nav } from "@/components/Nav";
import { ReportSkeleton, ReportView } from "@/components/ReportView";
import type { FullReport, SuggestItem } from "@/lib/types";

type BulkRow = {
  address: string;
  ok: boolean;
  total?: number | null;
  weergavenaam?: string;
  error?: string;
};

export default function ZakelijkPage() {
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [bulk, setBulk] = useState<BulkRow[] | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  async function load(item: SuggestItem) {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(
        `/api/score?id=${encodeURIComponent(item.id)}&profile=commercial`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kon rapport niet laden");
      setReport(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setLoading(false);
    }
  }

  async function runBulk() {
    const addresses = csv
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (!addresses.length) return;
    setBulkLoading(true);
    setBulk(null);
    try {
      const res = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses, profile: "commercial" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bulk mislukt");
      setBulk(json.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk mislukt");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="zakelijk" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 pb-16 pt-8">
        <section className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
            Zakelijk
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">
            Due Diligence Copilot
          </h1>
          <p className="max-w-2xl text-[var(--muted)]">
            Voor makelaars, beleggers en projectontwikkelaars: één adres, alle
            openbare signalen, risico-checklist en PDF-export. API-keys en
            hogere limieten via{" "}
            <a href="/prijzen" className="underline">
              Prijzen
            </a>
            .
          </p>
          <div className="max-w-xl pt-2">
            <AddressSearch onSelect={load} />
          </div>
        </section>

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800">{error}</p>
        )}
        {loading && <ReportSkeleton />}
        {report && !loading && <ReportView report={report} mode="commercial" />}

        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white/70 p-5 print:hidden">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Bulk (max 20 op de site)</h2>
          <p className="text-sm text-[var(--muted)]">
            Plak adressen gescheiden door komma of nieuwe regel (max 20 op deze
            pagina). De API hanteert je planlimiet. Keys aanmaken:{" "}
            <a href="/account" className="underline">
              account
            </a>
            .
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-[var(--border)] p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder={"Dam 1, Amsterdam\nCoolsingel 40, Rotterdam"}
          />
          <button
            type="button"
            onClick={runBulk}
            disabled={bulkLoading}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {bulkLoading ? "Bezig…" : "Bulk scoren"}
          </button>
          {bulk && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-2">Adres</th>
                  <th className="py-2">Score</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {bulk.map((r) => (
                  <tr key={r.address} className="border-b border-[var(--border)]">
                    <td className="py-2">{r.weergavenaam ?? r.address}</td>
                    <td className="py-2">{r.ok ? (r.total ?? "—") : "—"}</td>
                    <td className="py-2">{r.ok ? "ok" : r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 print:hidden">
        <Disclaimer />
      </footer>
    </div>
  );
}
