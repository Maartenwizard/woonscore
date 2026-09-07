"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function AuthButtons() {
  return (
    <div className="flex items-center gap-3">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Inloggen
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
          >
            Account
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/account"
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Account
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
