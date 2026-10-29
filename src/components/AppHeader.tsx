"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, FileText, LayoutDashboard, List, Menu, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useAdminRequests } from "@/components/useScheduleRequests";
import { collapse, pageTransition } from "@/lib/motionPresets";

const EMPLOYEE_NAV = [
  { href: "/me/availability", label: "Calendar", icon: CalendarDays },
  { href: "/me/schedule", label: "Schedule", icon: List },
];

/** Manager flow: check the week -> review availability & generate -> adjust & post. */
const ADMIN_NAV = [
  { href: "/admin/review", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/generate", label: "Generate", icon: ClipboardList },
  { href: "/admin/edit", label: "Schedule", icon: FileText },
];

/** Secondary manager pages live in the dropdown menu, not the tab bar. */
const ADMIN_MENU = [
  { href: "/employees", label: "Employees" },
  { href: "/admin/requests", label: "Approvals" },
];

function navFor(pathname: string) {
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
  const { signOut } = useAuth();
  const { requests } = useAdminRequests();
  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;
  const items = navFor(pathname);
  const admin = items === ADMIN_NAV;
  const [menuOpen, setMenuOpen] = useState(false);
  const reduce = useReducedMotion();
  // Links shown inline in the desktop header.
  const inlineLinks = admin
    ? items.map((item) => ({ href: item.href, label: item.label }))
    : [
        { href: "/me/availability", label: "My availability" },
        { href: "/me/schedule", label: "My schedule" },
      ];
  // Links in the dropdown menu. Managers get only the secondary pages (the tabs are always visible).
  const menuLinks = admin ? ADMIN_MENU : inlineLinks;

  function logOut() {
    setMenuOpen(false);
    void signOut().finally(() => router.push("/"));
  }

  return (
    <>
      <header className={admin ? "waffle relative px-4 py-3 sm:px-6 lg:px-8" : "bg-[var(--bg)] px-4 pb-1 pt-4 sm:px-6 lg:px-8"}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={`font-serif text-[15px] leading-tight sm:text-base ${admin ? "text-[#f7f1e6]" : "text-[var(--chrome)]"}`}>
              Bethlehem Dairy Store
            </p>
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                admin ? "text-[#eadfce]" : "text-[var(--muted)]"
              }`}
            >
              Staff scheduling
            </p>
          </div>
          {items.length > 0 ? (
            <div className="flex min-w-0 items-center gap-2">
              <nav className="hidden min-w-0 items-center gap-1 md:flex" aria-label="Main">
                {inlineLinks.map((link) => {
                  const active = linkIsActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap ${
                        admin
                          ? active
                            ? "bg-[#f7f1e6] text-[var(--chrome)]"
                            : "text-[#f7f1e6] hover:bg-white/10"
                          : active
                            ? "bg-[var(--surface)] text-[var(--chrome)] shadow-sm"
                            : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--chrome)]"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                {admin ? null : (
                  <button
                    type="button"
                    className="rounded-full px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--chrome)]"
                    onClick={logOut}
                  >
                    Log out
                  </button>
                )}
              </nav>
              <button
                type="button"
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  admin
                    ? "bg-[#f7f1e6] text-[var(--chrome)]"
                    : "bg-[var(--surface)] text-[var(--chrome)] shadow-sm md:hidden"
                }`}
                aria-label={admin && pendingCount > 0 ? `Menu, ${pendingCount} waiting for approval` : "Menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
                {admin && pendingCount > 0 && !menuOpen ? (
                  <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-[#f7f1e6] bg-[#d4533f]" aria-hidden />
                ) : null}
              </button>
            </div>
          ) : null}
        </div>
        <AnimatePresence initial={false}>
          {menuOpen ? (
            <motion.nav
              className={`mt-3 overflow-hidden rounded-2xl bg-[var(--surface)] p-2 text-[var(--text)] shadow-sm ${
                admin ? "md:absolute md:right-8 md:top-full md:z-50 md:mt-1 md:w-60 md:shadow-lg" : "md:hidden"
              }`}
              aria-label="Menu"
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
