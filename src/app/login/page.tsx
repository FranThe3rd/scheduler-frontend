"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { MotionReveal } from "@/components/MotionReveal";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, isAdmin, signIn: signInAs, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) router.replace("/admin/review");
  }, [isAdmin, router]);

  async function signIn() {
    setBusy(true);
    await signInAs("admin");
    setBusy(false);
  }

  const denied = !loading && user && !isAdmin;

  return (
    <div className="min-h-dvh">
      <header className="waffle px-6 py-8 text-center sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--chrome-muted)]">
          Bethlehem Dairy Store
        </p>
        <p className="mt-2 font-serif text-2xl text-[var(--chrome-text)]">Admin Login</p>
      </header>
      <main className="mx-auto w-full max-w-sm px-4 py-8 sm:px-6">
        <MotionReveal className="card p-5">
          <h1 className="text-2xl">Manager access</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Demo mode — no real accounts. Everything is mock data saved in this browser.
          </p>
          {denied ? (
            <>
              <p
                role="alert"
                className="mt-3 border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn-text)]"
              >
                {user.email} isn&apos;t authorized for manager access.
              </p>
              <button
                type="button"
                className="btn btn-primary mt-4 w-full"
                onClick={() => void signOut()}
              >
                Use a different account
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary mt-5 w-full"
              disabled={busy || loading}
              onClick={() => void signIn()}
            >
              {busy ? "Signing in…" : "Sign in as demo manager"}
            </button>
          )}
          <p className="mt-4 text-center text-sm">
            <Link href="/" className="font-semibold underline">
              Back to welcome
            </Link>
          </p>
        </MotionReveal>
      </main>
    </div>
  );
}
