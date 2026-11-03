"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { PageFrame } from "@/components/PageFrame";
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
import { shiftPlaceLabel } from "@/components/shiftChip";
import { formatShiftTimes, formatWeekRange, shiftDurationHours, thisWeekMondayNy, weekDates } from "@/lib/time";

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
      <div className="mt-4 inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--surface-2)]"
          aria-label="Previous week"
          onClick={() => shiftWeek(-7)}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="px-1 text-sm font-semibold">
          {weekStart === thisMonday ? "This week · " : ""}
          {formatWeekRange(weekStart)}
        </span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--surface-2)]"
          aria-label="Next week"
          onClick={() => shiftWeek(7)}
        >
          <ChevronRight size={18} />
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
      {!data ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Loading schedule…</p>
      ) : (
        <div className="mt-4 grid w-full grid-cols-7 gap-2" aria-label="Your week">
          {weekDates(weekStart).map((date) => {
            const dayShifts = shifts.filter((shift) => shift.date === date);
            const working = dayShifts.length > 0;
            return (
              <article
                key={date}
                className={`@container min-w-0 overflow-hidden rounded-2xl px-1.5 py-3 text-center sm:px-2 sm:py-4 ${
                  working
                    ? "bg-[var(--loc-linden-bg)] text-[var(--loc-linden-fg)]"
                    : "border border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <p className="font-serif text-sm font-semibold leading-none @[7.75rem]:hidden">{format(parseISO(date), "EEE")}</p>
                <p className="hidden truncate font-serif text-[clamp(0.95rem,16cqw,1.5rem)] font-semibold leading-none @[7.75rem]:block">{format(parseISO(date), "EEEE")}</p>
                <p className={`mt-1 text-sm ${working ? "opacity-70" : "text-[var(--muted)]"}`}>{format(parseISO(date), "d")}</p>
                {working ? (
                  <div className="mt-3 space-y-3">
                    {dayShifts.map((shift) => {
                      const shiftHours = shiftDurationHours(shift.startMinutes, shift.endMinutes);
                      return (
                        <div key={shift.id}>
                          <p className="text-xs font-semibold leading-tight sm:text-sm">{formatShiftTimes(shift.startMinutes, shift.endMinutes)}</p>
                          <p className="mt-1 text-xs">
                            {shiftHours ? `${Number.isInteger(shiftHours) ? shiftHours : shiftHours.toFixed(1)} hours` : "Duration needed"}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide">{shiftPlaceLabel(shift)}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 font-serif text-2xl leading-none text-[var(--faint)]" aria-label="Off">
                    —
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
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
