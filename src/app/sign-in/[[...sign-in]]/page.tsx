import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="mb-8 text-xl font-semibold tracking-tight text-[var(--ink)]">
        Woon<span className="text-[var(--accent)]">score</span>
      </Link>
      <SignIn />
    </div>
  );
}
