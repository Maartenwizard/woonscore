"use client";

import { useState } from "react";
import { AddressSearch } from "@/components/AddressSearch";
import { Disclaimer, Nav } from "@/components/Nav";
import { ReportSkeleton, ReportView } from "@/components/ReportView";
import type { FullReport, SuggestItem } from "@/lib/types";

export default function HomePage() {
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(item: SuggestItem) {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(
        `/api/score?id=${encodeURIComponent(item.id)}&profile=consumer`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kon score niet laden");
      setReport(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="home" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        {!report && !loading && (
          <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 pt-16 text-center md:pt-24">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
              Open data · Nederland
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--ink)] md:text-5xl">
              Woonscore
            </h1>
            <p className="max-w-md text-lg text-[var(--muted)]">
              Voer een adres in. Wij combineren openbare bronnen tot één simpele
              score: moet je hier wonen?
            </p>
            <div className="w-full">
              <AddressSearch onSelect={load} />
            </div>
          </section>
        )}

        {(loading || report || error) && (
          <section className="space-y-8 pt-6">
            <div className="max-w-xl">
              <AddressSearch onSelect={load} />
            </div>
            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800">{error}</p>
            )}
            {loading && <ReportSkeleton />}
            {report && !loading && <ReportView report={report} mode="consumer" />}
          </section>
        )}
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8">
        <Disclaimer />
      </footer>
    </div>
  );
}
