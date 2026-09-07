import type { DecisionMemo } from "@/lib/types";

const OORDEEL_STYLE: Record<DecisionMemo["oordeel"], string> = {
  groen: "bg-emerald-50 text-emerald-900 border-emerald-200",
  oranje: "bg-amber-50 text-amber-950 border-amber-200",
  rood: "bg-rose-50 text-rose-900 border-rose-200",
};

const OORDEEL_DOT: Record<DecisionMemo["oordeel"], string> = {
  groen: "bg-emerald-500",
  oranje: "bg-amber-500",
  rood: "bg-rose-500",
};

export function DecisionMemoView({ memo }: { memo: DecisionMemo }) {
  return (
    <section className="space-y-4">
      <div
        className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${OORDEEL_STYLE[memo.oordeel]}`}
      >
        <span
          className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${OORDEEL_DOT[memo.oordeel]}`}
        />
        <div>
          <h2 className="text-lg font-semibold">{memo.oordeelLabel}</h2>
          {memo.kernpunten.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {memo.kernpunten.map((k) => (
                <li key={k}>• {k}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="font-semibold text-[var(--ink)]">
            Vragen voor de bezichtiging
          </h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--ink)]">
            {memo.vragen.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <h3 className="font-semibold text-[var(--ink)]">
              Documenten om op te vragen
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-[var(--ink)]">
              {memo.documenten.map((d) => (
                <li key={d} className="flex gap-2">
                  <span className="text-[var(--accent)]">▢</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>

          {memo.kosten.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <h3 className="font-semibold text-[var(--ink)]">
                Reken op deze kosten
              </h3>
              <ul className="mt-3 space-y-3 text-sm">
                {memo.kosten.map((k) => (
                  <li key={k.post}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[var(--ink)]">{k.post}</span>
                      <span className="shrink-0 font-semibold text-[var(--accent)]">
                        {k.bandbreedte}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{k.toelichting}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
