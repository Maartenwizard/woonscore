import { Disclaimer, Nav } from "@/components/Nav";
import { ReportView } from "@/components/ReportView";
import { loadReport } from "@/lib/cache";
import { reportFromQuery } from "@/lib/service/report";
import type { FullReport } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RapportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let report: FullReport | null = null;

  const cached = loadReport(id);
  if (cached) {
    report = cached.report as FullReport;
  } else {
    try {
      report = await reportFromQuery({
        nummeraanduiding: id,
        profile: "consumer",
      });
    } catch {
      report = null;
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="home" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8">
        {!report ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Rapport niet gevonden</h1>
            <p className="text-[var(--muted)]">
              Dit rapport staat nog niet in de cache. Zoek het adres opnieuw.
            </p>
            <Link href="/" className="text-[var(--accent)] underline">
              Naar zoeken
            </Link>
          </div>
        ) : (
          <ReportView report={report} mode="consumer" />
        )}
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8">
        <Disclaimer />
      </footer>
    </div>
  );
}
