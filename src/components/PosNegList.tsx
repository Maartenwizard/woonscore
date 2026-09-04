import type { Bullet } from "@/lib/types";

export function PosNegList({
  positives,
  negatives,
}: {
  positives: Bullet[];
  negatives: Bullet[];
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Positief
        </h3>
        <ul className="space-y-2">
          {positives.length === 0 && (
            <li className="text-sm text-[var(--muted)]">Geen opvallende pluspunten</li>
          )}
          {positives.map((b) => (
            <li
              key={b.text}
              className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
            >
              {b.text}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-rose-700">
          Negatief
        </h3>
        <ul className="space-y-2">
          {negatives.length === 0 && (
            <li className="text-sm text-[var(--muted)]">Geen opvallende minpunten</li>
          )}
          {negatives.map((b) => (
            <li key={b.text} className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-950">
              {b.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
