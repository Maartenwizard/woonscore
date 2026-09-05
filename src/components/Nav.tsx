import Link from "next/link";

export function Nav({
  active,
}: {
  active?: "home" | "vergelijk" | "zakelijk" | "docs" | "status";
}) {
  const link = (href: string, id: typeof active, label: string) => (
    <Link
      href={href}
      className={`text-sm ${active === id ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
    >
      {label}
    </Link>
  );

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
      <Link href="/" className="text-xl font-semibold tracking-tight text-[var(--ink)]">
        Woon<span className="text-[var(--accent)]">score</span>
      </Link>
      <nav className="flex items-center gap-5">
        {link("/", "home", "Consument")}
        {link("/vergelijk", "vergelijk", "Vergelijk")}
        {link("/zakelijk", "zakelijk", "Zakelijk")}
        {link("/docs", "docs", "API")}
        {link("/status", "status", "Status")}
      </nav>
    </header>
  );
}

export function Disclaimer({ text }: { text?: string }) {
  return (
    <p className="text-xs leading-relaxed text-[var(--muted)]">
      {text ??
        "Indicatief op basis van openbare data. Geen taxatie of bouwkundig advies. Bronnen o.a. Kadaster/PDOK, RVO EP-Online, CBS, Politie (CC BY 4.0), RIVM, Klimaateffectatlas (CC BY 4.0)."}
    </p>
  );
}
