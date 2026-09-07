"use client";

import { useUser } from "@clerk/nextjs";
import { SignUpButton } from "@clerk/nextjs";
import { useState } from "react";
import { Disclaimer, Nav } from "@/components/Nav";
import { CREDIT_PACK_EUR, CREDIT_PACK_SIZE, PLANS } from "@/lib/plans";

export default function PrijzenPage() {
  const { isSignedIn } = useUser();
  const [error, setError] = useState<string | null>(null);

  async function checkout(kind: "zakelijk" | "credits") {
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Checkout mislukt");
      return;
    }
    window.location.href = json.url;
  }

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="prijzen" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 pb-16 pt-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Prijzen</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Consumentenrapporten op de site blijven gratis. Een account ontgrendelt
            eigen API-keys, hogere limieten en extra credits.
          </p>
        </div>

        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800">{error}</p>}

        <div className="grid gap-6 md:grid-cols-3">
          <PlanCard
            name={PLANS.free.name}
            price="€0"
            items={[
              "Onbeperkt zoeken op de website",
              `${PLANS.free.monthly} API-rapporten / maand`,
              `${PLANS.free.hourly} requests / uur`,
              `${PLANS.free.maxKeys} API-key`,
              `Bulk tot ${PLANS.free.bulkMax} adressen`,
            ]}
          >
            {isSignedIn ? (
              <span className="text-sm text-[var(--muted)]">Huidig startplan</span>
            ) : (
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  Maak een account
                </button>
              </SignUpButton>
            )}
          </PlanCard>

          <PlanCard
            name={PLANS.zakelijk.name}
            price={`€${PLANS.zakelijk.priceMonthlyEur}/mnd`}
            highlight
            items={[
              `${PLANS.zakelijk.monthly} API-rapporten / maand`,
              `${PLANS.zakelijk.hourly} requests / uur`,
              `${PLANS.zakelijk.maxKeys} API-keys`,
              `Bulk tot ${PLANS.zakelijk.bulkMax} adressen`,
              "PDF-export en due-diligence checklist",
            ]}
          >
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => checkout("zakelijk")}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Start Zakelijk
              </button>
            ) : (
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  Eerst inloggen
                </button>
              </SignUpButton>
            )}
          </PlanCard>

          <PlanCard
            name="Extra rapporten"
            price={`€${CREDIT_PACK_EUR}`}
            items={[
              `${CREDIT_PACK_SIZE} extra API-rapporten`,
              "Eenmalig, geen abonnement",
              "Bovenop je maandlimiet",
              "Voor pieken in een portefeuille",
            ]}
          >
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => checkout("credits")}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
              >
                Koop credits
              </button>
            ) : (
              <SignUpButton mode="modal">
                <button type="button" className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm">
                  Eerst inloggen
                </button>
              </SignUpButton>
            )}
          </PlanCard>
        </div>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8">
        <Disclaimer />
      </footer>
    </div>
  );
}

function PlanCard({
  name,
  price,
  items,
  highlight,
  children,
}: {
  name: string;
  price: string;
  items: string[];
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${highlight ? "border-[var(--accent)] bg-white shadow-sm" : "border-[var(--border)] bg-white/70"}`}
    >
      <h2 className="text-lg font-semibold">{name}</h2>
      <p className="mt-1 text-2xl font-semibold text-[var(--accent)]">{price}</p>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--muted)]">
        {items.map((i) => (
          <li key={i}>• {i}</li>
        ))}
      </ul>
      <div className="mt-6">{children}</div>
    </div>
  );
}
