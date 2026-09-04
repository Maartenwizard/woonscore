"use client";

import { useState } from "react";
import type { PartialScore } from "@/lib/types";

function barColor(score: number) {
  if (score >= 75) return "bg-emerald-600";
  if (score >= 55) return "bg-amber-500";
  return "bg-rose-500";
}

export function ScoreBars({ partials }: { partials: PartialScore[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {partials.map((p) => {
        const score = p.score;
        const isOpen = open === p.key;
        return (
          <div key={p.key} className="rounded-xl border border-[var(--border)] bg-white p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 text-left"
              onClick={() => setOpen(isOpen ? null : p.key)}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--ink)]">{p.label}</span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {score == null ? "n.b." : `${score}/100`}
                  </span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--surface)]">
                  {score != null && (
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
                      style={{ width: `${score}%` }}
                    />
                  )}
                  {p.benchmark != null && (
                    <span
                      className="absolute top-0 h-full w-0.5 bg-[var(--ink)]/40"
                      style={{ left: `${p.benchmark}%` }}
                      title="Benchmark"
                    />
                  )}
                </div>
              </div>
            </button>
            {isOpen && p.details.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted)]">
                {p.details.map((d) => (
                  <li key={d}>• {d}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
