"use client";

import { useState } from "react";
import { AddressSearch } from "@/components/AddressSearch";
import { Disclaimer, Nav } from "@/components/Nav";
import type { FullReport, SuggestItem } from "@/lib/types";

const MAX_ADDRESSES = 4;

interface Entry {
  id: string;
  loading: boolean;
  error?: string;
  report?: FullReport;
}

export default function VergelijkPage() {
  const [entries, setEntries] = useState<Entry[]>([]);

  async function add(item: SuggestItem) {
    if (entries.length >= MAX_ADDRESSES) return;
    if (entries.some((e) => e.id === item.id)) return;
    setEntries((prev) => [...prev, { id: item.id, loading: true }]);
    try {
      const res = await fetch(
        `/api/score?id=${encodeURIComponent(item.id)}&profile=consumer`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kon rapport niet laden");
      setEntries((prev) =>
        prev.map((e) => (e.id === item.id ? { ...e, loading: false, report: json } : e)),
      );
    } catch (err) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === item.id
            ? {
                ...e,
                loading: false,
                error: err instanceof Error ? err.message : "Er ging iets mis",
              }
            : e,
        ),
      );
    }
  }

  function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const loaded = entries.filter((e) => e.report);
  const pillarKeys = loaded[0]?.report?.score.partials.map((p) => p.key) ?? [];

  function bestValue(values: Array<number | null>): number | null {
    const nums = values.filter((v): v is number => v != null);
    return nums.length >= 2 ? Math.max(...nums) : null;
  }

  const totalRow = loaded.map((e) => e.report!.score.total);
  const bestTotal = bestValue(totalRow);

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="vergelijk" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 pb-16 pt-8">
        <section className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
            Vergelijk
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">
            Adressen naast elkaar
          </h1>
          <p className="max-w-2xl text-[var(--muted)]">
            Voeg twee tot vier adressen toe en vergelijk de Woonscore en alle
            deelscores in één overzicht.
          </p>
          {entries.length < MAX_ADDRESSES && (
            <div className="max-w-xl pt-2">
              <AddressSearch onSelect={add} placeholder="Voeg een adres toe…" />
            </div>
          )}
        </section>

        {entries.length > 0 && (
          <section className="flex flex-wrap gap-2">
            {entries.map((e) => (
              <span
                key={e.id}
                className="flex items-center gap-2 rounded-full bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)]"
              >
                {e.report?.facts.address.weergavenaam ??
                  (e.loading ? "Laden…" : (e.error ?? e.id))}
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  aria-label="Verwijder adres"
                  className="text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  ×
                </button>
              </span>
            ))}
          </section>
        )}

        {loaded.length >= 1 && (
          <section className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">&nbsp;</th>
                  {loaded.map((e) => (
                    <th key={e.id} className="px-4 py-3 font-medium text-[var(--ink)]">
                      {e.report!.facts.address.weergavenaam}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border)] bg-white">
                  <td className="px-4 py-3 font-semibold text-[var(--ink)]">Woonscore</td>
                  {loaded.map((e) => {
                    const t = e.report!.score.total;
                    return (
                      <td
                        key={e.id}
                        className={`px-4 py-3 text-lg font-semibold ${bestTotal != null && t === bestTotal ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}
                      >
                        {t ?? "—"}
                        {bestTotal != null && t === bestTotal && loaded.length >= 2 && (
                          <span className="ml-1 text-xs font-normal">beste</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {pillarKeys.map((key) => {
                  const label = loaded[0]!.report!.score.partials.find(
                    (p) => p.key === key,
                  )!.label;
                  const values = loaded.map(
                    (e) =>
                      e.report!.score.partials.find((p) => p.key === key)?.score ?? null,
                  );
                  const best = bestValue(values);
                  return (
                    <tr key={key} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-2.5 text-[var(--muted)]">{label}</td>
                      {loaded.map((e, i) => (
                        <td
                          key={e.id}
                          className={`px-4 py-2.5 ${best != null && values[i] === best ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
                        >
                          {values[i] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-2.5 text-[var(--muted)]">Energielabel</td>
                  {loaded.map((e) => (
                    <td key={e.id} className="px-4 py-2.5 text-[var(--ink)]">
                      {e.report!.facts.energy?.labelklasse ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-2.5 text-[var(--muted)]">WOZ-waarde</td>
                  {loaded.map((e) => (
                    <td key={e.id} className="px-4 py-2.5 text-[var(--ink)]">
                      {e.report!.facts.woz?.actueleWaarde
                        ? `€ ${e.report!.facts.woz.actueleWaarde.toLocaleString("nl-NL")}`
                        : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-[var(--muted)]">Rapport</td>
                  {loaded.map((e) => (
                    <td key={e.id} className="px-4 py-2.5">
                      <a
                        href={`/rapport/${e.report!.facts.address.nummeraanduidingId}`}
                        className="text-[var(--accent)] underline-offset-2 hover:underline"
                      >
                        Bekijk rapport
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {loaded.length === 1 && (
          <p className="text-sm text-[var(--muted)]">
            Voeg nog een adres toe om te vergelijken.
          </p>
        )}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-8">
        <Disclaimer />
      </footer>
    </div>
  );
}
