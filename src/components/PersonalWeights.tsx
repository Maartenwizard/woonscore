"use client";

import { useMemo, useState } from "react";
import type { PartialScore, PartialScoreKey } from "@/lib/types";
import { DEFAULT_WEIGHTS, reweightTotal } from "@/lib/score/reweight";

const LABELS: Record<PartialScoreKey, string> = {
  woning: "Woning",
  waarde: "Waarde",
  veiligheid: "Veiligheid",
  milieu: "Milieu",
  klimaat: "Klimaat",
  voorzieningen: "Voorzieningen",
  buurt: "Buurt",
};

export function PersonalWeights({
  partials,
  officialTotal,
}: {
  partials: PartialScore[];
  officialTotal: number | null;
}) {
  const [weights, setWeights] = useState<Record<PartialScoreKey, number>>({
    ...DEFAULT_WEIGHTS,
  });
  const personal = useMemo(() => reweightTotal(partials, weights), [partials, weights]);

  function set(key: PartialScoreKey, value: number) {
    setWeights((w) => ({ ...w, [key]: value / 100 }));
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 p-5 print:hidden">
      <h2 className="text-lg font-semibold text-[var(--ink)]">Jouw weging</h2>
      <p className="text-sm text-[var(--muted)]">
        Verschuif wat jij belangrijk vindt. De officiële Woonscore blijft{" "}
        {officialTotal ?? "—"}; hieronder zie je jouw persoonlijke totaal.
      </p>
      <p className="text-3xl font-semibold tabular-nums text-[var(--accent)]">
        {personal ?? "—"}
        <span className="ml-2 text-sm font-normal text-[var(--muted)]">jouw score</span>
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {partials.map((p) => (
          <label key={p.key} className="block text-sm">
            <span className="flex justify-between text-[var(--ink)]">
              <span>{LABELS[p.key]}</span>
              <span className="tabular-nums text-[var(--muted)]">
                {Math.round(weights[p.key] * 100)}%
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={40}
              value={Math.round(weights[p.key] * 100)}
              onChange={(e) => set(p.key, Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
        className="text-sm text-[var(--accent)] underline-offset-2 hover:underline"
      >
        Herstel standaardgewichten
      </button>
    </section>
  );
}
