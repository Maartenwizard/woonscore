"use client";

import Link from "next/link";
import type { FullReport } from "@/lib/types";
import { Disclaimer } from "./Nav";
import { PosNegList } from "./PosNegList";
import { PropertyMap } from "./PropertyMap";
import { RiskChecklist } from "./RiskChecklist";
import { ScoreBars } from "./ScoreBars";
import { ScoreRing } from "./ScoreRing";

export function ReportView({
  report,
  mode = "consumer",
}: {
  report: FullReport;
  mode?: "consumer" | "commercial";
}) {
  const { facts, score } = report;
  const a = facts.address;

  const chips = [
    facts.bag?.bouwjaar ? `Bouwjaar ${facts.bag.bouwjaar}` : null,
    facts.bag?.oppervlakte ? `${facts.bag.oppervlakte} m²` : null,
    facts.energy?.labelklasse ? `Label ${facts.energy.labelklasse}` : null,
    facts.woz?.actueleWaarde
      ? `WOZ €${facts.woz.actueleWaarde.toLocaleString("nl-NL")}`
      : facts.cbs?.gemiddeldeWoz
        ? `Gem. WOZ buurt €${facts.cbs.gemiddeldeWoz.toLocaleString("nl-NL")}`
        : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-10 print:space-y-6">
      <section className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
        <ScoreRing
          score={score.total}
          label={mode === "commercial" ? "Due diligence" : "Woonscore"}
        />
        <div className="flex-1 space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] md:text-3xl">
            {a.weergavenaam}
          </h1>
          <div className="flex flex-wrap justify-center gap-2 md:justify-start">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full bg-[var(--surface)] px-3 py-1 text-sm text-[var(--ink)]"
              >
                {c}
              </span>
            ))}
          </div>
          {score.summary && (
            <p className="max-w-xl text-[var(--muted)]">{score.summary}</p>
          )}
          <div className="flex flex-wrap justify-center gap-3 md:justify-start">
            <Link
              href={`/rapport/${a.nummeraanduidingId}`}
              className="text-sm text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Deelbare link
            </Link>
            {mode === "commercial" && (
              <button
                type="button"
                onClick={() => window.print()}
                className="text-sm text-[var(--accent)] underline-offset-2 hover:underline print:hidden"
              >
                PDF / printen
              </button>
            )}
          </div>
        </div>
      </section>

      {mode === "commercial" && score.risks && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Risico-checklist</h2>
          <RiskChecklist risks={score.risks} />
        </section>
      )}

      <PropertyMap lat={a.lat} lon={a.lon} label={a.weergavenaam} />

      <PosNegList positives={score.positives} negatives={score.negatives} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Deelscores</h2>
        <ScoreBars partials={score.partials} />
      </section>

      {mode === "commercial" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Feiten & bronnen</h2>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Bron</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Latency</th>
                  <th className="px-3 py-2 font-medium">Opgehaald</th>
                </tr>
              </thead>
              <tbody>
                {facts.sources.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-2">{s.label}</td>
                    <td className="px-3 py-2 capitalize">{s.status}</td>
                    <td className="px-3 py-2">{s.latencyMs != null ? `${s.latencyMs} ms` : "—"}</td>
                    <td className="px-3 py-2">{s.fetchedAt?.slice(0, 19) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {facts.bekendmakingen?.samenvatting && (
            <p className="text-sm text-[var(--muted)]">
              Vergunningen: {facts.bekendmakingen.samenvatting}
            </p>
          )}
        </section>
      )}

      <Disclaimer text={score.disclaimer} />
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-6">
        <div className="h-40 w-40 rounded-full bg-[var(--surface)]" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-2/3 rounded bg-[var(--surface)]" />
          <div className="h-4 w-1/2 rounded bg-[var(--surface)]" />
          <div className="h-4 w-1/3 rounded bg-[var(--surface)]" />
        </div>
      </div>
      <div className="h-72 rounded-2xl bg-[var(--surface)]" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 rounded-xl bg-[var(--surface)]" />
        <div className="h-32 rounded-xl bg-[var(--surface)]" />
      </div>
    </div>
  );
}
