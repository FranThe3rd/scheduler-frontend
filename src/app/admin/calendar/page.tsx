"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO, startOfMonth } from "date-fns";
import { PageFrame } from "@/components/PageFrame";
import { MonthCalendar } from "@/components/MonthCalendar";
import { useAuth } from "@/components/AuthProvider";
import { useAdminRequests } from "@/components/useScheduleRequests";
import { useToday } from "@/components/useClientSession";
import { chipStyle } from "@/components/shiftChip";
import type { AvailabilityTone } from "@/components/availabilityTone";
import { apiFetch } from "@/lib/api/client";
import { mergeTeamSchedule } from "@/lib/mergeTeamSchedule";
import { formatCompactEmployeeName } from "@/lib/displayName";
import { shiftToCellText } from "@/lib/shiftCellText";
import { formatWeekRange, mondayOf, weekDates } from "@/lib/time";
import type { Employee, Shift, WeekSchedule } from "@/lib/types";

function mondayKey(date: string): string {
  return format(mondayOf(date), "yyyy-MM-dd");
}

/** Monday of every week that touches the month (calendar grid). */
function weekKeysForMonth(month: Date): string[] {
  const first = format(month, "yyyy-MM-01");
  const last = format(new Date(month.getFullYear(), month.getMonth() + 1, 0), "yyyy-MM-dd");
  const keys: string[] = [];
  let cursor = mondayOf(first);
  const end = mondayKey(last);
  while (format(cursor, "yyyy-MM-dd") <= end) {
    keys.push(format(cursor, "yyyy-MM-dd"));
    cursor = addDays(cursor, 7);
  }
  return keys;
}

export default function TeamCalendarPage() {
  const { rosterVersion, schedulerVersion } = useAuth();
  const { requests, error: requestsError } = useAdminRequests();
  const today = useToday();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [picked, setPicked] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Record<string, WeekSchedule>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selected = picked ?? today;

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      weekKeysForMonth(month).map(async (week) => {
        const res = await apiFetch(`/api/bootstrap?week=${encodeURIComponent(week)}&mode=shell`);
        if (!res.ok) return null;
        return [week, await res.json()] as const;
      })
    )
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, WeekSchedule> = {};
        let roster: Employee[] = [];
        for (const row of rows) {
          if (!row) continue;
          next[row[0]] = row[1].week as WeekSchedule;
          roster = (row[1].employees as Employee[]) ?? roster;
        }
        setWeeks(next);
        setEmployees(roster);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the calendar.");
      });
    return () => {
      cancelled = true;
    };
  }, [month, rosterVersion, schedulerVersion]);

  // Days that have at least one shift get a green dot.
  const marks = useMemo(() => {
    const out: Record<string, AvailabilityTone> = {};
    for (const week of Object.values(weeks)) {
      for (const shift of week.shifts) out[shift.date] = "available";
    }
    for (const request of requests ?? []) {
      if (request.status !== "approved") continue;
      for (const shift of request.assignedShifts) out[shift.date] = "available";
    }
    return out;
  }, [weeks, requests]);

  const weekStart = selected ? mondayKey(selected) : null;
  const week = weekStart ? weeks[weekStart] : undefined;
  const dates = weekStart ? weekDates(weekStart) : [];
  const merged = week
    ? mergeTeamSchedule({
        week,
        employees,
        approvedRequests: (requests ?? []).filter((request) => request.weekStart === weekStart),
      })
    : null;
  const visibleEmployees = merged?.employees ?? employees;
  const visibleShifts = merged?.shifts ?? [];
  const approvedRequests = (requests ?? []).filter(
    (request) =>
      request.weekStart === weekStart &&
      request.status === "approved" &&
      request.assignedShifts.length > 0
  );

  const rows = (() => {
    const active = visibleEmployees
      .filter((employee) => employee.status === "active")
      .sort((a, b) => formatCompactEmployeeName(a).localeCompare(formatCompactEmployeeName(b)));
    const named = active.map((employee) => ({
      key: employee.id,
      name: formatCompactEmployeeName(employee),
      match: (shift: Shift) => shift.employeeId === employee.id,
    }));
    // Shifts written on paper with a name that isn't matched to anyone yet.
    const labels = [
      ...new Set(
        (week?.shifts ?? []).filter((shift) => !shift.employeeId).map((shift) => shift.unresolvedLabel || "Unassigned")
      ),
    ];
    const unassigned = labels.map((label) => ({
      key: `label-${label}`,
      name: label,
      match: (shift: Shift) => !shift.employeeId && (shift.unresolvedLabel || "Unassigned") === label,
    }));
    return [...named, ...unassigned];
  })();

  const status =
    merged?.week.status === "approved" ||
    merged?.week.status === "confirmed_worked" ||
    approvedRequests.length > 0
      ? "Published"
      : week
        ? "Draft"
        : "";

  return (
    <PageFrame>
      <h1 className="text-[1.75rem] leading-none sm:text-[2rem]">Team calendar</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Everyone&apos;s shifts at a glance. Tap a date to see that week. Green dots are days with shifts.
      </p>
      {error || requestsError ? (
        <p role="alert" className="mt-3 text-sm text-[var(--conflict)]">
          {error ?? requestsError}
        </p>
      ) : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <MonthCalendar
          compact
          month={month}
          onMonth={setMonth}
          weekStart={weekStart}
          selectedDate={selected}
          marks={marks}
          onSelectDate={setPicked}
        />
        <section className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg">{weekStart ? formatWeekRange(weekStart) : "Loading…"}</h2>
            {status ? <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{status}</span> : null}
          </div>
          {!week ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-[var(--surface)] px-3 py-3 text-sm">
              No staff yet. Employees show up here automatically after they sign in with Google.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="week-chip-table text-xs">
                <thead>
                  <tr>
                    <th className="pb-2 pr-2 text-left font-semibold text-[var(--muted)]">Employee</th>
                    {dates.map((date) => (
                      <th
                        key={date}
                        className={`min-w-10 pb-2 font-semibold sm:min-w-14 ${
                          date === today ? "text-[var(--chrome)]" : "text-[var(--muted)]"
                        }`}
                      >
                        <span className="sm:hidden">{format(parseISO(date), "EEEEE")}</span>
                        <span className="hidden sm:inline">{format(parseISO(date), "EEE")}</span>
                        <span className="mt-0.5 block font-normal">{format(parseISO(date), "d")}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className="py-1 pr-2 text-left text-sm font-semibold whitespace-nowrap">
                        {row.name}
                      </th>
                      {dates.map((date) => {
                        const shifts = visibleShifts.filter((shift) => shift.date === date && row.match(shift));
                        const text = shifts.length ? shifts.map((shift) => shiftToCellText(shift)).join(" / ") : "—";
                        return (
                          <td key={date} className="px-0.5 py-1 text-center">
                            <span
                              className={`inline-flex min-h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none sm:min-h-9 sm:min-w-12 sm:px-2 ${chipStyle(text)}`}
                            >
                              {text}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]" aria-label="Shift legend">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#b7d7a8]" /> Main store
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f3d56a]" /> Lehigh
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#d7e4f8]" /> Ice cream
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f4b7b8]" /> No shift
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {weekStart ? (
              <Link href={`/print/${weekStart}`} className="btn btn-primary h-11 rounded-full">
                Show staff schedule
              </Link>
            ) : null}
            <Link href="/admin/edit" className="btn btn-ghost h-11 rounded-full">
              Change shifts on the Schedule page →
            </Link>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
