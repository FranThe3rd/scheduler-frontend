"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, FileText, Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useAdminRequests } from "@/components/useScheduleRequests";
import { collapse, pageTransition } from "@/lib/motionPresets";

const EMPLOYEE_NAV = [
  { href: "/me/availability", label: "Availability", icon: CalendarDays },
  { href: "/me/schedule", label: "Schedule", icon: FileText },
];

/** Manager flow: check the week -> review availability & generate -> adjust & post. */
const ADMIN_NAV = [
  { href: "/admin/review", label: "Calendar", icon: CalendarDays },
  { href: "/admin/generate", label: "Generate", icon: Sparkles },
  { href: "/admin/edit", label: "Schedule", icon: FileText },
];

/** Secondary manager pages live in the account menu, not the tab bar. */
const ADMIN_MENU = [
  { href: "/employees", label: "Employees" },
  { href: "/admin/requests", label: "Approvals" },
];

function navFor(pathname: string, isAdmin: boolean) {
  if (pathname.startsWith("/print")) return isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;
  if (pathname.startsWith("/me")) return EMPLOYEE_NAV;
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/employees") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/history")
  ) {
    return ADMIN_NAV;
  }
  return [];
}

function linkIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, signOut } = useAuth();
  const { requests } = useAdminRequests();
  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;
  const items = navFor(pathname, isAdmin);
  const admin = items === ADMIN_NAV;
  const [menuOpen, setMenuOpen] = useState(false);
  const reduce = useReducedMotion();
  const menuLinks = admin ? ADMIN_MENU : [];
  const firstName = user?.displayName?.trim().split(/\s+/)[0] || "Account";
  const initial = firstName.slice(0, 1).toUpperCase();

  function logOut() {
    setMenuOpen(false);
    void signOut().finally(() => router.push("/"));
  }

  return (
    <>
      <header className="waffle relative px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[15px] leading-tight text-[#f7f1e6] sm:text-base">Bethlehem Dairy Store</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#eadfce]">Staff scheduling</p>
          </div>
          {items.length > 0 ? (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
              {items.map((link) => {
                const active = linkIsActive(pathname, link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${
                      active ? "bg-[#f7f1e6] text-[var(--chrome)]" : "text-[#f7f1e6] hover:bg-white/10"
                    }`}
                  >
                    <Icon size={15} strokeWidth={2.25} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
          {items.length > 0 ? (
            <div className="flex flex-1 justify-end">
              <button
                type="button"
                className="relative inline-flex h-11 items-center gap-2 rounded-full bg-[#f7f1e6] py-1 pl-1 pr-2.5 text-[var(--chrome)]"
                aria-label={
                  admin && pendingCount > 0
                    ? `Account menu for ${firstName}, ${pendingCount} waiting for approval`
                    : `Account menu for ${firstName}`
                }
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chrome)] text-sm font-semibold text-[#f7f1e6]">
                  {initial}
                </span>
                <span className="hidden text-sm font-semibold sm:inline">{firstName}</span>
                <ChevronDown size={15} />
                {admin && pendingCount > 0 && !menuOpen ? (
                  <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-[#f7f1e6] bg-[#d4533f]" aria-hidden />
                ) : null}
              </button>
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>
        <AnimatePresence initial={false}>
          {menuOpen ? (
            <motion.nav
              className="absolute right-4 top-full z-50 mt-1 w-60 overflow-hidden rounded-2xl bg-[var(--surface)] p-2 text-[var(--text)] shadow-lg sm:right-6 lg:right-8"
              aria-label="Account"
              variants={reduce ? undefined : collapse}
              initial={reduce ? false : "hidden"}
              animate="show"
              exit="exit"
              transition={{ ...pageTransition, duration: 0.22 }}
            >
              {menuLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                  {link.href === "/admin/requests" && pendingCount > 0 ? (
                    <span className="rounded-full bg-[#d4533f] px-2 text-[11px] font-bold leading-5 text-white">
                      {pendingCount} waiting
                    </span>
                  ) : null}
                </Link>
              ))}
              <button type="button" className="block min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold" onClick={logOut}>
                Log out
              </button>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>
      {items.length > 0 ? (
        <nav
          className="app-bottom-nav no-print fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[#fbf7f0] md:hidden"
          aria-label="Main"
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((item) => {
              const active = linkIsActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-semibold ${
                    active ? "nav-active" : "text-[#b7ab9e]"
                  }`}
                >
                  <Icon size={20} strokeWidth={2.25} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </>
  );
}
