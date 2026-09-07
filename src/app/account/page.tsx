import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AccountDashboard } from "@/components/AccountDashboard";
import { Disclaimer, Nav } from "@/components/Nav";
import { listKeys } from "@/lib/api-keys";
import { formatPrijs } from "@/lib/diensten";
import { listOrders } from "@/lib/orders";
import { ensureUser, monthlyUsage, planLimits } from "@/lib/users";

const ORDER_STATUS: Record<string, string> = {
  pending: "Wacht op betaling",
  paid: "Betaald — partner neemt contact op",
  canceled: "Geannuleerd",
};

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) redirect("/sign-in");

  const user = ensureUser(userId);
  const me = await currentUser();
  const limits = planLimits(user.plan);
  const orders = listOrders(userId);
  const params = await searchParams;
  const notice =
    params.checkout === "success"
      ? "Betaling ontvangen. Je plan of credits worden zo bijgewerkt."
      : params.checkout === "dienst"
        ? "Aanvraag ontvangen. Zodra de betaling is verwerkt, plant de partner de afspraak met je in."
        : null;

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="account" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 pb-16 pt-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">Account</h1>
          <p className="mt-2 text-[var(--muted)]">
            {me?.primaryEmailAddress?.emailAddress ?? "Ingelogd"}
          </p>
        </div>

        {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900">{notice}</p>}

        <AccountDashboard
          plan={user.plan}
          planName={limits.name}
          usage={monthlyUsage(userId)}
          monthly={limits.monthly}
          hourly={limits.hourly}
          bulkMax={limits.bulkMax}
          maxKeys={limits.maxKeys}
          extraCredits={user.extra_credits}
          keys={listKeys(userId).map((k) => ({
            id: k.id,
            prefix: k.prefix,
            name: k.name,
          }))}
        />

        {orders.length > 0 && (
          <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-lg font-semibold">Aangevraagde checks</h2>
            <ul className="divide-y divide-[var(--border)]">
              {orders.map((o) => (
                <li key={o.id} className="py-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-[var(--ink)]">
                      {o.dienst_naam} · {formatPrijs(o.amount_cents)}
                    </span>
                    <span
                      className={
                        o.status === "paid"
                          ? "text-emerald-700"
                          : o.status === "pending"
                            ? "text-amber-700"
                            : "text-[var(--muted)]"
                      }
                    >
                      {ORDER_STATUS[o.status] ?? o.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[var(--muted)]">
                    {o.adres} ·{" "}
                    {new Date(o.created_at).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-8">
        <Disclaimer />
      </footer>
    </div>
  );
}
