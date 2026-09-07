"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlanId } from "@/lib/plans";

interface KeyInfo {
  id: number;
  prefix: string;
  name: string | null;
}

export function AccountDashboard({
  plan,
  planName,
  usage,
  monthly,
  hourly,
  bulkMax,
  maxKeys,
  extraCredits,
  keys,
}: {
  plan: PlanId;
  planName: string;
  usage: number;
  monthly: number;
  hourly: number;
  bulkMax: number;
  maxKeys: number;
  extraCredits: number;
  keys: KeyInfo[];
}) {
  const router = useRouter();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createKey() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "API-key" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNewKey(json.raw);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aanmaken mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    await fetch(`/api/account/keys?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function checkout(kind: "zakelijk" | "credits") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout mislukt");
      setBusy(false);
    }
  }

  async function portal() {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal mislukt");
      setBusy(false);
    }
  }

  return (
    <>
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800">{error}</p>}

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-semibold">Plan: {planName}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Gebruik deze maand: {usage} / {monthly} API-rapporten
          {extraCredits > 0 ? ` · ${extraCredits} extra credits` : ""}
        </p>
        <p className="text-sm text-[var(--muted)]">
          Rate limit: {hourly}/uur · bulk max {bulkMax} · max {maxKeys} keys
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {plan === "free" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => checkout("zakelijk")}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Upgrade naar Zakelijk (€29/mnd)
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={portal}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
            >
              Abonnement beheren
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => checkout("credits")}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
          >
            +50 rapport-credits (€19)
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">API-keys</h2>
          <button
            type="button"
            disabled={busy}
            onClick={createKey}
            className="text-sm text-[var(--accent)] underline-offset-2 hover:underline"
          >
            Nieuwe key
          </button>
        </div>
        {newKey && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Kopieer nu, dit is de enige keer dat we de volledige key tonen:
            <code className="mt-1 block break-all font-mono">{newKey}</code>
          </p>
        )}
        {keys.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Nog geen keys. Maak er een aan voor de API.</p>
        )}
        <ul className="divide-y divide-[var(--border)]">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <code className="font-mono">{k.prefix}…</code>
                <span className="ml-2 text-[var(--muted)]">{k.name}</span>
              </span>
              <button
                type="button"
                onClick={() => revoke(k.id)}
                className="text-[var(--muted)] hover:text-rose-700"
              >
                Intrekken
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
