"use client";

import { useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { cellDetail, toneForCell } from "@/components/availabilityTone";
import {
  requestErrorMessage,
  requestId,
  submitRequest,
  withdrawRequest,
  type RequestDay,
  type ScheduleRequest,
} from "@/lib/scheduleRequests";
import { formatShiftTimes, formatWeekRange, weekDates } from "@/lib/time";
import type { WeekSchedule } from "@/lib/types";

export const TONE_CHIP = {
  available: "bg-[#b7d7a8] text-[#245033]",
  limited: "bg-[#f3d56a] text-[#6d5310]",
  off: "bg-[#f4b7b8] text-[#8d3d45]",
} as const;

/** "1 PM" -> "1", "9:30 AM" -> "9:30" — short enough to fit a narrow day chip. */
function compactClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, "0")}`;
}

/** Short label for the 7-column week strip on phones. */
export function shortDayLabel(day: RequestDay | undefined): string {
  if (!day) return "—";
  if (day.tone === "off") return "Off";
  if (day.tone === "available") return "All day";
  if (day.startMinutes != null && day.endMinutes != null) {
    return `${compactClock(day.startMinutes)}–${compactClock(day.endMinutes)}`;
  }
  return day.text.replace(/\s?(AM|PM)/gi, "").replace(/\s*–\s*/g, "–");
}

function sameDays(a: Record<string, RequestDay>, b: Record<string, RequestDay>): boolean {
  const key = (days: Record<string, RequestDay>) =>
    JSON.stringify(Object.entries(days).sort(([x], [y]) => x.localeCompare(y)));
  return key(a) === key(b);
}

/** Collects what the employee set for the week (today onward) as the submission contents. */
export function daysFromWeek(
  week: WeekSchedule | undefined,
  employeeId: string,
  today: string
): Record<string, RequestDay> {
  const out: Record<string, RequestDay> = {};
  if (!week) return out;
  const row = week.availability.find((item) => item.employeeId === employeeId);
  for (const date of weekDates(week.weekStart)) {
    if (date < today) continue;
    const cell = row?.cells[date];
    const tone = toneForCell(cell);
    if (tone !== "available" && tone !== "limited" && tone !== "off") continue;
    out[date] = {
      tone,
      text: tone === "limited" ? cellDetail(cell) : tone === "off" ? "Off" : "Available all day",
      startMinutes: cell?.window?.startMinutes,
      endMinutes: cell?.window?.endMinutes,
    };
  }
  return out;
}

/** "Send this week to your manager" — one button per week, shows approval status. */
export function WeekSubmitPanel({
  weekStart,
  week,
  employeeId,
  uid,
  name,
  today,
  request,
  onChanged,
  selectedDate,
  onSelectDay,
  editor,
}: {
  weekStart: string;
  week: WeekSchedule | undefined;
  employeeId: string;
  uid: string;
  name: string;
  today: string;
  request: ScheduleRequest | null;
  onChanged: () => Promise<void>;
  /** Day currently being edited, and a way to pick another by tapping it here. */
  selectedDate?: string | null;
  onSelectDay?: (date: string) => void;
  /** Inline day editor shown under the days when one is being edited here. */
  editor?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = daysFromWeek(week, employeeId, today);
  const dates = weekDates(weekStart);
  const hasDays = Object.keys(current).length > 0;
  const status = request?.status ?? null;
  const changed = request ? !sameDays(request.days, current) : true;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await submitRequest({ uid, name, weekStart, days: current });
      await onChanged();
    } catch (err) {
      setError(requestErrorMessage(err));
    }
    setBusy(false);
  }

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      await withdrawRequest(requestId(uid, weekStart));
      await onChanged();
    } catch (err) {
      setError(requestErrorMessage(err));
    }
    setBusy(false);
  }

  return (
    <section className="card p-4 shadow-none" aria-label="Send week for approval">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">{formatWeekRange(weekStart)}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            status === "approved"
              ? "bg-[#d9efd4] text-[#245033]"
              : status === "declined"
                ? "bg-[#f7d6d4] text-[#8d3d45]"
                : status === "pending"
                  ? "bg-[#f6ead0] text-[#8a6a20]"
                  : "bg-[var(--surface-2)] text-[var(--muted)]"
          }`}
        >
          {status === "approved"
            ? "Approved"
            : status === "declined"
              ? "Declined"
              : status === "pending"
                ? changed
                  ? "Sent · changed since"
                  : "Waiting for approval"
                : "Not sent"}
        </span>
      </div>
      <ul className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold sm:text-[11px]">
        {dates.map((date) => {
          const day = current[date];
          const past = date < today;
          const canEdit = !!onSelectDay && !past && status !== "approved";
          const picked = selectedDate === date;
          return (
            <li key={date} className="min-w-0">
              <p className="text-[var(--muted)]">{format(parseISO(date), "EEEEE")}<span className="hidden sm:inline">{format(parseISO(date), "EEE").slice(1)}</span></p>
              <p className="text-[10px] font-normal text-[var(--muted)]">{format(parseISO(date), "d")}</p>
              <button
                type="button"
                disabled={!canEdit}
                aria-pressed={picked}
                aria-label={`${format(parseISO(date), "EEEE MMM d")}, ${day ? day.text : "not set"}${canEdit ? ", tap to change" : ""}`}
                onClick={() => onSelectDay?.(date)}
                className={`mt-1 flex min-h-12 w-full items-center justify-center rounded-xl px-0.5 py-1 leading-tight break-words ${
                  day ? TONE_CHIP[day.tone] : "border border-dashed border-[#d9cfc2] text-[var(--muted)]"
                } ${picked ? "ring-2 ring-[var(--chrome)]" : ""} ${past ? "opacity-35" : ""} ${canEdit ? "" : "cursor-default"}`}
              >
                {shortDayLabel(day)}
              </button>
            </li>
          );
        })}
      </ul>
      {selectedDate && current[selectedDate]?.tone === "limited" ? (
        <p className="mt-2 text-center text-xs text-[var(--muted)]">
          {format(parseISO(selectedDate), "EEEE")}: {current[selectedDate]?.text}
        </p>
      ) : null}
      {onSelectDay && status !== "approved" ? (
        <p className="mt-2 text-xs text-[var(--muted)]">Tap a day to set it.</p>
      ) : null}
      {editor}
      {status === "approved" ? (
        <div className="mt-3 rounded-2xl bg-[#d9efd4] px-3 py-3 text-sm text-[#245033]">
          <p className="font-semibold">Approved by your manager</p>
          {request?.assignedShifts.length ? (
            <ul className="mt-2 space-y-1">
              {request.assignedShifts.map((shift) => (
                <li key={shift.date}>
                  <span className="font-semibold">{format(parseISO(shift.date), "EEEE, MMMM d")}</span> ·{" "}
                  {formatShiftTimes(shift.startMinutes, shift.endMinutes)} ·{" "}
                  {shift.department === "ic" ? "Ice Cream" : "Floor"} ·{" "}
                  {shift.location === "lehigh" ? "Lehigh" : "Main store"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">This week is locked now.</p>
          )}
        </div>
      ) : (
        <>
          {status === "declined" ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Your manager declined this week. Change your days above and send it again.
            </p>
          ) : null}
          {!hasDays ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Set at least one day first.</p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-[var(--conflict)]">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary mt-3 h-12 w-full rounded-full text-base"
            disabled={busy || !hasDays || (status === "pending" && !changed)}
            onClick={() => void send()}
          >
            {busy
              ? "Sending…"
              : status === "pending"
                ? changed
                  ? "Update what I sent"
                  : "Sent ✓"
                : "Send week for approval"}
          </button>
          {status === "pending" ? (
            <button type="button" className="mt-2 text-sm font-semibold underline" disabled={busy} onClick={() => void withdraw()}>
              Withdraw
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
