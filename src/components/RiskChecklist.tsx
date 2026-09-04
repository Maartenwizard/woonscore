import type { RiskItem } from "@/lib/types";

const COLORS: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  red: "bg-rose-500",
  unknown: "bg-slate-300",
};

export function RiskChecklist({ risks }: { risks: RiskItem[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {risks.map((r) => (
        <div
          key={r.id}
          className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white p-3"
        >
          <span
            className={`mt-1 h-3 w-3 shrink-0 rounded-full ${COLORS[r.level]}`}
            title={r.level}
          />
          <div>
            <div className="font-medium text-[var(--ink)]">{r.label}</div>
            <div className="text-sm text-[var(--muted)]">{r.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
