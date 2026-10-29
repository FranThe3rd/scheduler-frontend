"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { PageFrame } from "@/components/PageFrame";
import { ScheduleExportButtons } from "@/components/ScheduleExportButtons";
import { ScheduleTable } from "@/components/ScheduleTable";
import { useAuth } from "@/components/AuthProvider";
import { useAdminRequests } from "@/components/useScheduleRequests";
import { apiFetch } from "@/lib/api/client";
import { mergeTeamSchedule } from "@/lib/mergeTeamSchedule";
import {
  subscribePublishedSchedule,
  type PublishedSchedule,
} from "@/lib/publishedSchedules";
import { formatWeekRange, thisWeekMondayNy } from "@/lib/time";
import type { Employee, WeekSchedule } from "@/lib/types";

type Bootstrap = {
  employees: Employee[];
  week: WeekSchedule;
};

export default function StaffSchedulesPage() {
  const { rosterVersion, schedulerVersion } = useAuth();
  const { requests, error: requestsError } = useAdminRequests();
  const [weekStart, setWeekStart] = useState(thisWeekMondayNy);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [published, setPublished] = useState<PublishedSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiFetch(`/api/bootstrap?week=${encodeURIComponent(weekStart)}&mode=shell`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this week.");
        const payload = (await response.json()) as Bootstrap;
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this week.");
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart, rosterVersion, schedulerVersion]);

  useEffect(() => {
    return subscribePublishedSchedule(
      weekStart,
      setPublished,
      () => setPublished(null)
    );
  }, [weekStart]);

  const weekOptions = [
    ...new Set([
      weekStart,
      thisWeekMondayNy(),
      ...(requests ?? []).map((request) => request.weekStart),
    ]),
  ].sort((a, b) => b.localeCompare(a));

  const merged = data
    ? mergeTeamSchedule({
        week: data.week,
        employees: data.employees,
        published: published?.weekStart === weekStart ? published : null,
        approvedRequests: (requests ?? []).filter((request) => request.weekStart === weekStart),
      })
    : null;
  const displayWeek = merged?.week ?? null;
  const employees = merged?.employees ?? [];
  const shifts = merged?.shifts ?? [];

  function moveWeek(days: number) {
    setWeekStart(format(addDays(parseISO(weekStart), days), "yyyy-MM-dd"));
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] leading-none sm:text-[2rem]">Staff schedules</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Every approved employee schedule, updated live.
          </p>
        </div>
        {displayWeek ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/print/${weekStart}`} className="btn btn-primary rounded-full">
              <Printer size={16} />
              Print full schedule
            </Link>
            <ScheduleExportButtons
              week={displayWeek}
              employees={employees}
              shifts={shifts}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[var(--surface)] p-2">
        <button
          type="button"
          className="btn btn-ghost btn-icon shrink-0"
          aria-label="Previous week"
          onClick={() => moveWeek(-7)}
        >
          <ChevronLeft size={18} />
        </button>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Select week</span>
          <select
            className="input w-full rounded-full text-center font-semibold"
            value={weekStart}
            onChange={(event) => setWeekStart(event.target.value)}
          >
            {weekOptions.map((option) => (
              <option key={option} value={option}>
                {formatWeekRange(option)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-icon shrink-0"
          aria-label="Next week"
          onClick={() => moveWeek(7)}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {error || requestsError ? (
        <p role="alert" className="mt-3 text-sm text-[var(--conflict)]">
          {error ?? requestsError}
        </p>
      ) : null}

      {!displayWeek ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Loading schedule…</p>
      ) : shifts.length === 0 ? (
        <p className="card mt-4 px-4 py-6 text-sm text-[var(--muted)] shadow-none">
          No approved employee shifts for {formatWeekRange(weekStart)}.
        </p>
      ) : (
        <div className="table-scroll mt-4">
          <ScheduleTable
            week={displayWeek}
            employees={employees}
            shifts={shifts}
          />
        </div>
      )}
    </PageFrame>
  );
}
