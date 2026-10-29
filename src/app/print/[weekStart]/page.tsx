"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { dayOfWeekFromDate, weekDates, formatWeekRange, minutesToLabel } from "@/lib/time";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/components/AuthProvider";
import { useAdminRequests } from "@/components/useScheduleRequests";
import { ScheduleExportButtons } from "@/components/ScheduleExportButtons";
import { CompactWeekGrid, buildGridRows } from "@/components/CompactWeekGrid";
import { ScheduleTable } from "@/components/ScheduleTable";
import { mergeTeamSchedule } from "@/lib/mergeTeamSchedule";
import {
  subscribePublishedSchedule,
  type PublishedSchedule,
} from "@/lib/publishedSchedules";
import { revalidateWeek } from "@/lib/validation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import type { Employee, WeekSchedule, StaffingIntervalTarget } from "@/lib/types";

type PrintPayload = {
  week: WeekSchedule;
  employees: Employee[];
  staffingTargets: StaffingIntervalTarget[];
};

export default function PrintPage() {
  const params = useParams();
  const { isAdmin, schedulerVersion } = useAuth();
  const { requests: adminRequests } = useAdminRequests();
  const weekStart = typeof params.weekStart === "string" ? params.weekStart : "";
  const backHref = isAdmin ? "/admin/edit" : "/me/schedule";
  const [payload, setPayload] = useState<PrintPayload | null>(null);
  const [published, setPublished] = useState<PublishedSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishedError, setPublishedError] = useState<string | null>(null);

  useEffect(() => {
    if (!weekStart) return;
    let cancelled = false;
    void (async () => {
      setError(null);
      setPayload(null);
      const res = await apiFetch(`/api/print?weekStart=${encodeURIComponent(weekStart)}`);
      if (!res.ok) {
        if (!cancelled) {
          setError(
            res.status === 404
              ? "Print data not found. Implement GET /api/print?weekStart= on your backend."
              : "Could not load print view."
          );
        }
        return;
      }
      const json = (await res.json()) as PrintPayload;
      if (!cancelled) setPayload(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, schedulerVersion]);

  useEffect(() => {
    if (!weekStart) return;
    return subscribePublishedSchedule(
      weekStart,
      (schedule) => {
        setPublished(schedule);
        setPublishedError(null);
      },
      () => setPublishedError("Could not load the shared published schedule.")
    );
  }, [weekStart]);

  if (error) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="app-nav-pad mx-auto max-w-lg px-4 py-10 text-sm">
          <p className="text-[var(--conflict)]">{error}</p>
          <Link href={backHref} className="btn btn-ghost mt-4 inline-block">
            Back
          </Link>
        </main>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="app-nav-pad mx-auto max-w-lg px-4 py-10 text-sm text-[var(--muted)]">Loading…</main>
      </div>
    );
  }

  const { staffingTargets } = payload;
  const currentPublished = published?.weekStart === weekStart ? published : null;
  const merged = mergeTeamSchedule({
    week: payload.week,
    employees: payload.employees,
    published: currentPublished,
    approvedRequests: (adminRequests ?? []).filter((request) => request.weekStart === weekStart),
  });
  const { week: displayWeek, employees, shifts } = merged;
  const v = revalidateWeek({
    shifts,
    availability: displayWeek.availability,
    employees,
    targets: staffingTargets,
    weekStart: displayWeek.weekStart,
  });
  const dates = weekDates(displayWeek.weekStart);
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));
  const coverage = v.coverage.filter((c) => c.status !== "no_target");

  return (
    <div className="min-h-screen bg-white">
      <div className="no-print">
        <AppHeader />
      </div>
      <main className="app-nav-pad mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <div className="no-print mb-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} />
            Print / PDF
          </button>
          <ScheduleExportButtons week={displayWeek} employees={employees} shifts={shifts} />
          <Link href={backHref} className="btn btn-ghost">
            Back
          </Link>
        </div>
        {publishedError ? (
          <p role="alert" className="no-print mb-4 text-sm text-[var(--conflict)]">
            {publishedError}
          </p>
        ) : null}

        <header className="print-schedule-header">
          <h1 className="text-xl font-semibold">Bethlehem Dairy Store</h1>
          <p className="text-[var(--muted)]">Weekly schedule · {formatWeekRange(displayWeek.weekStart)}</p>
          <p className="text-xs text-[var(--muted)] no-print">
            Status: {displayWeek.status}
            {displayWeek.approvedAt ? ` · approved ${displayWeek.approvedAt}` : " · current draft"}
          </p>
        </header>

        {/* On screen: the same compact week view as the manager's Schedule tab. */}
        <div className="mt-4 print:hidden">
          <CompactWeekGrid
            dates={dates}
            rows={buildGridRows(employees, shifts, { onlyScheduled: true })}
            shifts={shifts}
          />
          <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]" aria-label="Shift legend">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#b7d7a8]" /> Main store
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f3d56a]" /> Lehigh (L)
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#d7e4f8]" /> Ice cream (IC)
            </li>
          </ul>
        </div>
        {/* On paper: the full printed table. */}
        <div className="table-scroll mt-6 print-table-wrap hidden print:block">
          <ScheduleTable week={displayWeek} employees={employees} shifts={shifts} />
        </div>

        <div className="no-print mt-8 space-y-4 text-sm">
        <h2 className="text-base font-semibold">Daily coverage recap</h2>
        <div className="mt-3 space-y-4">
          {dates.map((date) => {
            const dayRows = coverage
              .filter((c) => c.date === date)
              .sort(
                (a, b) =>
                  a.location.localeCompare(b.location) || a.startMinutes - b.startMinutes
              );
            if (dayRows.length === 0) return null;
            return (
              <div key={date}>
                <div className="font-semibold capitalize">
                  {dayOfWeekFromDate(date)} {date.slice(5)}
                </div>
                <ul className="mt-1 space-y-1">
                  {dayRows.map((c) => {
                    const names = (c.assignedEmployeeIds ?? [])
                      .map(
                        (id) =>
                          empMap[id]?.printedLabel ?? empMap[id]?.displayName ?? id
                      )
                      .join(", ");
                    const short = Math.max(0, c.minimum - c.count);
                    return (
                      <li key={`${c.location}-${c.startMinutes}-${c.endMinutes}`}>
                        {(c.location === "lehigh" ? "Lehi" : "Main") +
                          ` ${minutesToLabel(c.startMinutes)}–${minutesToLabel(c.endMinutes)}` +
                          ` · need ${c.minimum} · assigned ${c.count}` +
                          (names ? ` (${names})` : "") +
                          (short > 0 ? ` · SHORT BY ${short}` : " · covered")}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        </div>
      </main>
    </div>
  );
}
