"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { Users } from "lucide-react";
import { PageFrame } from "@/components/PageFrame";
import { MotionItem, MotionReveal } from "@/components/MotionReveal";
import { useAuth } from "@/components/AuthProvider";
import { ScheduleExportButtons } from "@/components/ScheduleExportButtons";
import { useWeekBootstrap } from "@/components/useWeekBootstrap";
import { useEmployeeId } from "@/components/useClientSession";
import { subscribeMyRequests, type ScheduleRequest } from "@/lib/scheduleRequests";
import { mergeTeamSchedule } from "@/lib/mergeTeamSchedule";
import {
  subscribePublishedSchedule,
  type PublishedSchedule,
} from "@/lib/publishedSchedules";
import { formatShiftTimes, formatWeekRange, shiftDurationHours, thisWeekMondayNy } from "@/lib/time";
import type { Shift } from "@/lib/types";

function shiftTone(shift: Shift): { bar: string; bg: string } {
  if (shift.department === "ic") return { bar: "#8fb0e0", bg: "#e3ecf9" };
  if (shift.location === "lehigh") return { bar: "#e0b93a", bg: "#fbf1c4" };
  return { bar: "#7fbf7b", bg: "#e6f2df" };
}

function placeLabel(shift: Shift): string {
  const place = shift.location === "lehigh" ? "Lehi" : shift.location === "linden" ? "Linden" : "";
  if (shift.department === "ic") return place ? `Ice Cream · ${place}` : "Ice Cream";
  return place || "Location needed";
}

export default function MySchedulePage() {
  const { weekStart, setWeekStart, data, error } = useWeekBootstrap();
  const { user } = useAuth();
  const employeeId = useEmployeeId();
  const [requests, setRequests] = useState<ScheduleRequest[] | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [published, setPublished] = useState<PublishedSchedule | null>(null);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const jumped = useRef(false);

  useEffect(() => {
    if (!user) return;
    return subscribeMyRequests(
      user.uid,
      (list) => {
        setRequests(list);
        setRequestsError(null);
      },
      () => setRequestsError("Could not load your approved schedules.")
    );
  }, [user]);

  useEffect(() => {
    if (!weekStart) return;
    return subscribePublishedSchedule(
      weekStart,
      (schedule) => {
        setPublished(schedule);
        setPublishedError(null);
      },
      () => setPublishedError("Could not load the latest published schedule.")
    );
  }, [weekStart]);

  const thisMonday = thisWeekMondayNy();
  const approvedWeeks = (requests ?? [])
    .filter((request) => request.status === "approved" && request.weekStart >= thisMonday)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const approvedRequest =
    requests?.find((request) => request.weekStart === weekStart && request.status === "approved") ?? null;

  useEffect(() => {
    if (jumped.current || !requests || !weekStart) return;
    jumped.current = true;
    const hasCurrent = requests.some((r) => r.weekStart === weekStart && r.status === "approved");
    const next = requests
      .filter((r) => r.status === "approved" && r.weekStart > weekStart)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))[0];
    if (!hasCurrent && next) setWeekStart(next.weekStart);
  }, [requests, weekStart, setWeekStart]);

  function shiftWeek(days: number) {
    if (!weekStart) return;
    setWeekStart(format(addDays(parseISO(weekStart), days), "yyyy-MM-dd"));
  }

  const merged = data
    ? mergeTeamSchedule({
        week: data.week,
        employees: data.employees,
        published: published?.weekStart === weekStart ? published : null,
        approvedRequests: requests ?? [],
      })
    : null;
  const employee = merged?.employees.find((item) => item.id === employeeId) ?? null;
  const shifts =
    merged && employeeId
      ? merged.shifts
          .filter((shift) => shift.employeeId === employeeId)
          .sort((a, b) => a.date.localeCompare(b.date) || (a.startMinutes ?? 0) - (b.startMinutes ?? 0))
      : [];

  const hours = shifts.reduce((sum, shift) => sum + shiftDurationHours(shift.startMinutes, shift.endMinutes), 0);
  const status = approvedRequest
    ? "Approved"
    : merged?.week.status === "approved" || merged?.week.status === "confirmed_worked"
      ? "Published"
      : "Draft";
  const range = data ? format(parseISO(data.week.weekStart), "MMM d") + "–" + format(parseISO(data.week.weekEnd), "d") : "";

  if (!weekStart) {
    return (
      <PageFrame>
        <p className="text-[var(--muted)]">Loading…</p>
      </PageFrame>
    );
  }

  if (!employeeId) {
    return (
      <PageFrame>
        <p className="text-[var(--muted)]">Setting up your profile…</p>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <h1 className="text-[1.75rem] leading-tight sm:text-[2rem]">My schedule</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {status}
        {range ? ` · ${range}` : ""}
      </p>
      <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-[var(--surface)] px-2 py-1">
        <button
          type="button"
          className="min-h-11 min-w-11 rounded-full text-xl"
          aria-label="Previous week"
          onClick={() => shiftWeek(-7)}
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {weekStart === thisMonday ? "This week" : "Week"}
          </p>
          <p className="font-serif text-lg leading-tight">{formatWeekRange(weekStart)}</p>
        </div>
        <button
          type="button"
          className="min-h-11 min-w-11 rounded-full text-xl"
          aria-label="Next week"
          onClick={() => shiftWeek(7)}
        >
          ›
        </button>
      </div>
      {approvedWeeks.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Approved weeks</p>
          <div className="scroll-row -mx-4 mt-1 px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {approvedWeeks.map((request) => (
              <button
                key={request.id}
                type="button"
                aria-pressed={request.weekStart === weekStart}
                className={`min-h-9 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                  request.weekStart === weekStart
                    ? "bg-[#245033] text-white"
                    : "bg-[#d9efd4] text-[#245033]"
                }`}
                onClick={() => setWeekStart(request.weekStart)}
              >
                {formatWeekRange(request.weekStart)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {error || requestsError || publishedError ? (
        <p role="alert" className="mt-3 text-sm text-[var(--conflict)]">
          {error ?? requestsError ?? publishedError}
        </p>
      ) : null}
      <section className="card mt-4 px-4 py-3 shadow-none">
        <p className="font-serif text-lg">{employee?.displayName ?? "Your shifts"}</p>
        <p className="text-sm text-[var(--muted)]">
          {shifts.length} {shifts.length === 1 ? "shift" : "shifts"} · {Number.isInteger(hours) ? hours : hours.toFixed(1)} hours
        </p>
      </section>
      <MotionReveal stagger className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {!data ? (
          <p className="text-sm text-[var(--muted)] sm:col-span-2">Loading schedule…</p>
        ) : shifts.length === 0 ? (
          <p className="card px-4 py-6 text-sm text-[var(--muted)] shadow-none sm:col-span-2">No shifts assigned this week.</p>
        ) : (
          shifts.map((shift) => {
            const shiftHours = shiftDurationHours(shift.startMinutes, shift.endMinutes);
            const tone = shiftTone(shift);
            return (
              <MotionItem key={shift.id}>
                <article
                  className="flex items-center gap-3 rounded-xl py-2 pl-3 pr-3"
                  style={{ background: tone.bg, borderLeft: `4px solid ${tone.bar}` }}
                >
                  <div className="w-12 shrink-0 text-center leading-tight">
                    <p className="text-[11px] font-semibold uppercase text-[var(--muted)]">{format(parseISO(shift.date), "EEE")}</p>
                    <p className="font-serif text-xl">{format(parseISO(shift.date), "d")}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{formatShiftTimes(shift.startMinutes, shift.endMinutes)}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{placeLabel(shift)}</p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold tabular-nums">
                    {shiftHours ? `${Number.isInteger(shiftHours) ? shiftHours : shiftHours.toFixed(1)}h` : "—"}
                  </p>
                </article>
              </MotionItem>
            );
          })
        )}
      </MotionReveal>
      {data ? (
        <div className="mt-4 space-y-2 text-center">
          <Link href={`/print/${weekStart}`} className="btn btn-ghost h-12 w-full rounded-full text-base md:w-auto md:min-w-64">
            <Users size={16} />
            View team schedule
          </Link>
          <div className="flex justify-center pt-1">
            <ScheduleExportButtons
              week={merged?.week ?? data.week}
              employees={merged?.employees ?? data.employees}
              shifts={merged?.shifts ?? shifts}
              variant="link"
            />
          </div>
        </div>
      ) : null}
    </PageFrame>
  );
}
