"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { MotionItem, MotionReveal } from "@/components/MotionReveal";
import { formatWeekRange, thisWeekMondayNy } from "@/lib/time";

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading, isAdmin, signIn, signOut } = useAuth();

  async function userLogin() {
    if (!user || isAdmin) await signIn("employee");
    router.push("/me/availability");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f6f1e8]">
      <header className="waffle px-6 pb-12 pt-12 text-center sm:rounded-b-[42px] sm:px-8 sm:pb-16 sm:pt-16">
        <h1 className="text-[1.75rem] leading-tight text-[#f7f1e6] sm:text-[2rem]">Bethlehem Dairy Store</h1>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#eadfce]">Staff scheduling</p>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-8 pt-10 sm:px-8">
        <MotionReveal>
          <h2 className="text-center text-[2.25rem] leading-[1.05] text-[var(--chrome)] sm:text-[2.6rem]">Who&apos;s working</h2>
          <p className="mt-3 text-center text-sm text-[var(--muted)]">This week · {formatWeekRange(thisWeekMondayNy())}</p>
        </MotionReveal>
        <MotionReveal stagger className="mt-8 space-y-3">
          <MotionItem>
            <button
              type="button"
              className="btn btn-primary h-12 w-full rounded-full text-base"
              disabled={loading}
              onClick={() => router.push(isAdmin ? "/admin/review" : "/login")}
            >
              Admin Login
            </button>
          </MotionItem>
          <MotionItem>
            <button
              type="button"
              className="btn btn-ghost h-12 w-full rounded-full border-[var(--chrome)] text-base"
              disabled={loading}
              onClick={() => void userLogin()}
            >
              User Login
            </button>
          </MotionItem>
        </MotionReveal>
        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          Demo mode · mock data saved in this browser only
        </p>
        {user ? (
          <p className="mt-4 text-center text-xs text-[var(--muted)]">
            Signed in as {user.email}{" "}
            <button type="button" className="font-semibold underline" onClick={() => void signOut()}>
              Sign out
            </button>
          </p>
        ) : null}
        <div className="mt-auto" />
      </main>
      <div className="waffle h-28 sm:h-36 sm:rounded-t-[42px]" aria-hidden />
    </div>
  );
}
