import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AccountDashboard } from "@/components/AccountDashboard";
import { Disclaimer, Nav } from "@/components/Nav";
import { listKeys } from "@/lib/api-keys";
import { ensureUser, monthlyUsage, planLimits } from "@/lib/users";

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
  const params = await searchParams;
  const notice =
    params.checkout === "success"
      ? "Betaling ontvangen. Je plan of credits worden zo bijgewerkt."
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
      </main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-8">
        <Disclaimer />
      </footer>
    </div>
  );
}
