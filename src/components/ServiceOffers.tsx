"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { formatPrijs, type Dienst } from "@/lib/diensten";

/**
 * Bestelbare vervolgchecks bij het rapport: de scan is gratis, een
 * specialist op locatie niet. Betaling via Stripe Checkout.
 */
export function ServiceOffers({
  diensten,
  adres,
  nummeraanduidingId,
}: {
  diensten: Dienst[];
  adres: string;
  nummeraanduidingId: string;
}) {
  const { isSignedIn } = useUser();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!diensten.length) return null;

  async function bestel(dienstId: string) {
    if (!isSignedIn) {
      window.location.assign(
        `/sign-in?redirect_url=${encodeURIComponent(`/rapport/${nummeraanduidingId}`)}`,
      );
      return;
    }
    setBusy(dienstId);
    setError(null);
    try {
      const res = await fetch("/api/services/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dienstId, adres, nummeraanduidingId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Aanvragen mislukt");
      window.location.assign(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aanvragen mislukt");
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3 print:hidden">
      <h2 className="text-lg font-semibold text-[var(--ink)]">
        Laat het echt checken
      </h2>
      <p className="text-sm text-[var(--muted)]">
        De scan hierboven is gratis en op basis van open data. Voor zekerheid
        op locatie vraag je hieronder een specialist aan — vaste prijs, rapport
        in je account.
      </p>
      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {diensten.map((d) => (
          <div
            key={d.id}
            className="flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-[var(--ink)]">{d.naam}</h3>
              <span className="shrink-0 text-lg font-semibold text-[var(--accent)]">
                {formatPrijs(d.prijsCent)}
              </span>
            </div>
            {d.reden && (
              <p className="mt-1 text-sm font-medium text-[var(--ink)]">{d.reden}</p>
            )}
            <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{d.omschrijving}</p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => bestel(d.id)}
              className="mt-4 self-start rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === d.id
                ? "Bezig…"
                : isSignedIn
                  ? "Aanvragen"
                  : "Inloggen en aanvragen"}
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--muted)]">
        Richtprijzen incl. btw; uitvoering door een gecertificeerde partner.
        Annuleren kan kosteloos tot de afspraak is ingepland.
      </p>
    </section>
  );
}
