"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] px-6 text-center">{children}</div>;
}

/** Requires a signed-in Google account; with `admin`, also requires an allow-listed admin email. */
export function AuthGuard({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const router = useRouter();
  const { user, loading, isAdmin, employeeId, signOut, ensureEmployee } = useAuth();
  const needsEmployee = !admin && !!user && !employeeId;

  useEffect(() => {
    if (!loading && !user) router.replace(admin ? "/login" : "/");
  }, [loading, user, admin, router]);

  // Staff area: create the person's roster entry from their Google profile on first visit.
  useEffect(() => {
    if (!loading && needsEmployee) void ensureEmployee();
  }, [loading, needsEmployee, ensureEmployee]);

  if (loading || !user || needsEmployee) {
    return (
      <Centered>
        <p className="text-[var(--muted)]">Loading…</p>
      </Centered>
    );
  }

  if (admin && !isAdmin) {
    return (
      <Centered>
        <div className="card max-w-sm p-5">
          <h1 className="text-2xl">Admins only</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {user.email} doesn&apos;t have manager access.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-4 w-full"
            onClick={() => {
              void signOut().then(() => router.replace("/"));
            }}
          >
            Sign out
          </button>
        </div>
      </Centered>
    );
  }

  return <>{children}</>;
}
