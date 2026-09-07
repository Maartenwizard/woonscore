import type { Improvement } from "@/lib/types";

const IMPACT: Record<Improvement["impact"], string> = {
  high: "grote impact",
  medium: "middel",
  low: "klein",
};

export function Improvements({ items }: { items: Improvement[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[var(--ink)]">Wat kun je verbeteren</h2>
      <p className="text-sm text-[var(--muted)]">
        Signalen op basis van open data — geen bouwkundig of financieel advies.
      </p>
      <ul className="space-y-3">
        {items.map((i) => (
          <li
            key={i.id}
            className="rounded-xl border border-[var(--border)] bg-white p-4"
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <h3 className="font-medium text-[var(--ink)]">{i.title}</h3>
              <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {IMPACT[i.impact]}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">{i.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
