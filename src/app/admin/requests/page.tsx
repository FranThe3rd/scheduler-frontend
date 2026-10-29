"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { PageFrame } from "@/components/PageFrame";
import { StaggerList } from "@/components/MotionReveal";
import { fadeUp, pageTransition } from "@/lib/motionPresets";
import { useAuth } from "@/components/AuthProvider";
import { useAdminRequests } from "@/components/useScheduleRequests";
import { TONE_CHIP } from "@/components/WeekSubmitPanel";
import { apiFetch } from "@/lib/api/client";
import {
  deleteScheduleRequest,
  decideRequest,
  requestErrorMessage,
  type AssignedShift,
  type RequestStatus,
  type ScheduleRequest,
} from "@/lib/scheduleRequests";
import { publishEmployeeSchedule } from "@/lib/publishedSchedules";
import { formatShiftTimes, formatWeekRange, minutesToLabel } from "@/lib/time";

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: "bg-[#f6ead0] text-[#8a6a20]",
  approved: "bg-[#d9efd4] text-[#245033]",
  declined: "bg-[#f7d6d4] text-[#8d3d45]",
};

const TIME_OPTIONS = Array.from({ length: 33 }, (_, index) => 6 * 60 + index * 30);

function initialShifts(request: ScheduleRequest): Record<string, AssignedShift> {
  const existing = new Map(request.assignedShifts.map((shift) => [shift.date, shift]));
  return Object.fromEntries(
    Object.entries(request.days)
      .filter(([, day]) => day.tone !== "off")
      .map(([date, day]) => {
        const saved = existing.get(date);
        return [
          date,
          saved ?? {
            date,
            startMinutes: day.startMinutes ?? 9 * 60,
            endMinutes: day.endMinutes ?? 13 * 60,
            location: "linden",
            department: "floor",
          },
        ];
      })
  );
}

function RequestCard({ request, adminEmail }: { request: ScheduleRequest; adminEmail: string }) {
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workingDates = Object.entries(request.days)
    .filter(([, day]) => day.tone !== "off")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date]) => date);
  const [shifts, setShifts] = useState<Record<string, AssignedShift>>(() => initialShifts(request));

  function updateShift(date: string, change: Partial<AssignedShift>) {
    setShifts((current) => ({
      ...current,
      [date]: { ...current[date]!, ...change, date },
    }));
  }

  async function decide(status: RequestStatus) {
    setBusy(true);
    setError(null);
    try {
      const assignedShifts = status === "approved" ? workingDates.map((date) => shifts[date]!) : undefined;
      await decideRequest(request.id, status, adminEmail, assignedShifts);
      if ((status === "approved" && assignedShifts) || request.status === "approved") {
        await publishEmployeeSchedule({
          weekStart: request.weekStart,
          employeeId: request.uid,
          employeeName: request.name,
          shifts: status === "approved" ? assignedShifts ?? [] : [],
          approvedBy: adminEmail,
        });
        const response = await apiFetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekStart: request.weekStart,
            action: "assign_employee_week",
            employeeId: request.uid,
            shifts: status === "approved" ? assignedShifts : [],
          }),
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "The week was approved, but could not be added to the schedule.");
        }
      }
    } catch (err) {
      setError(requestErrorMessage(err));
    }
    setBusy(false);
  }

  async function removeRecord() {
    if (!window.confirm(`Permanently delete ${request.name}'s request for ${formatWeekRange(request.weekStart)}?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (request.status === "approved") {
        await publishEmployeeSchedule({
          weekStart: request.weekStart,
          employeeId: request.uid,
          employeeName: request.name,
          shifts: [],
          approvedBy: adminEmail,
        });
        const response = await apiFetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekStart: request.weekStart,
            action: "assign_employee_week",
            employeeId: request.uid,
            shifts: [],
          }),
        });
        if (!response.ok && response.status !== 404) {
          throw new Error("Could not remove the assigned shifts.");
        }
      }
      await deleteScheduleRequest(request.id);
    } catch (err) {
      setError(requestErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <motion.li
      className="card p-4 shadow-none"
      variants={reduce ? undefined : fadeUp}
      transition={pageTransition}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-serif text-lg leading-tight">{request.name}</p>
          <p className="text-sm text-[var(--muted)]">{formatWeekRange(request.weekStart)}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[request.status]}`}>
          {request.status}
        </span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(request.days)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, day]) => (
            <li key={date} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CHIP[day.tone] ?? ""}`}>
              {format(parseISO(date), "EEE d")} · {day.text}
            </li>
          ))}
      </ul>
      {error ? <p className="mt-2 text-sm text-[var(--conflict)]">{error}</p> : null}
      {request.status === "pending" ? (
        <fieldset className="mt-4 border-t border-[var(--border)] pt-3">
          <legend className="px-1 text-sm font-semibold">Review every selected day</legend>
          {workingDates.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--conflict)]">
              This employee did not submit an available day, so the week cannot be approved.
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              {workingDates.map((date) => {
                const shift = shifts[date]!;
                return (
                  <section key={date} className="rounded-2xl bg-[var(--surface-2)] p-3">
                    <p className="font-semibold">{format(parseISO(date), "EEEE, MMM d")}</p>
                    <p className="text-xs text-[var(--muted)]">Employee chose: {request.days[date]?.text}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label>
                        <span className="field-label">Start</span>
                        <select
                          className="input w-full"
                          value={shift.startMinutes}
                          onChange={(event) => updateShift(date, { startMinutes: Number(event.target.value) })}
                        >
                          {TIME_OPTIONS.map((minutes) => (
                            <option key={minutes} value={minutes}>{minutesToLabel(minutes)}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="field-label">End</span>
                        <select
                          className="input w-full"
                          value={shift.endMinutes}
                          onChange={(event) => updateShift(date, { endMinutes: Number(event.target.value) })}
                        >
                          {TIME_OPTIONS.map((minutes) => (
                            <option key={minutes} value={minutes}>{minutesToLabel(minutes)}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="field-label">Store</span>
                        <select
                          className="input w-full"
                          value={shift.location}
                          onChange={(event) => updateShift(date, { location: event.target.value as AssignedShift["location"] })}
                        >
                          <option value="linden">Main store</option>
                          <option value="lehigh">Lehigh</option>
                        </select>
                      </label>
                      <label>
                        <span className="field-label">Department</span>
                        <select
                          className="input w-full"
                          value={shift.department}
                          onChange={(event) => updateShift(date, { department: event.target.value as AssignedShift["department"] })}
                        >
                          <option value="floor">Floor</option>
                          <option value="ic">Ice Cream</option>
                        </select>
                      </label>
                    </div>
                    {shift.endMinutes <= shift.startMinutes ? (
                      <p className="mt-1 text-xs text-[var(--conflict)]">End time must be after start time.</p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </fieldset>
      ) : request.assignedShifts.length ? (
        <div className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm">
          <p className="font-semibold">Assigned schedule</p>
          <ul className="mt-1 space-y-1">
            {request.assignedShifts.map((shift) => (
              <li key={shift.date}>
                {format(parseISO(shift.date), "EEEE, MMM d")} ·{" "}
                {formatShiftTimes(shift.startMinutes, shift.endMinutes)} ·{" "}
                {shift.department === "ic" ? "Ice Cream" : "Floor"} ·{" "}
                {shift.location === "lehigh" ? "Lehigh" : "Main store"}
              </li>
            ))}
          </ul>
          <Link
            href={`/print/${request.weekStart}`}
            className="mt-2 inline-block font-semibold underline"
          >
            View full staff schedule
          </Link>
        </div>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {request.status === "pending" ? (
          <>
            <button
              type="button"
              className="btn btn-primary h-12 w-full rounded-full text-base sm:h-10 sm:w-auto sm:text-sm"
              disabled={
                busy ||
                workingDates.length === 0 ||
                workingDates.some((date) => shifts[date]!.endMinutes <= shifts[date]!.startMinutes)
              }
              onClick={() => void decide("approved")}
            >
              {busy ? "Working…" : `Approve ${workingDates.length} ${workingDates.length === 1 ? "day" : "days"}`}
            </button>
            <button
              type="button"
              className="btn btn-ghost h-12 w-full rounded-full text-base sm:h-10 sm:w-auto sm:text-sm"
              disabled={busy}
              onClick={() => void decide("declined")}
            >
              Decline
            </button>
          </>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <button
              type="button"
              className="min-h-11 text-sm font-semibold underline"
              disabled={busy}
              onClick={() => void decide("pending")}
            >
              Undo (set back to waiting)
            </button>
            <button
              type="button"
              className="min-h-11 text-sm font-semibold text-[var(--conflict)] underline"
              disabled={busy}
              onClick={() => void removeRecord()}
            >
              Delete record
            </button>
          </div>
        )}
      </div>
    </motion.li>
  );
}

export default function RequestsPage() {
  const { user } = useAuth();
  const { requests, error } = useAdminRequests();
  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const decided = requests?.filter((r) => r.status !== "pending") ?? [];
  const approvedWeeks = [
    ...new Set(
      (requests ?? [])
        .filter((request) => request.status === "approved")
        .map((request) => request.weekStart)
    ),
  ].sort((a, b) => b.localeCompare(a));
  const email = user?.email ?? "";

  return (
    <PageFrame>
      <h1 className="text-[1.75rem] leading-none sm:text-[2rem]">Weeks to approve</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Weeks employees sent in. Approving locks that week for them. Their days also appear on the{" "}
        <Link href="/admin/generate" className="font-semibold underline">
          Availability page
        </Link>
        .
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--conflict)]">
          {error}
        </p>
      ) : null}
      {approvedWeeks.length > 0 ? (
        <section className="mt-4 rounded-2xl bg-[var(--surface)] p-4">
          <h2 className="font-serif text-lg">Full staff schedules</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {approvedWeeks.map((weekStart) => (
              <Link
                key={weekStart}
                href={`/print/${weekStart}`}
                className="btn btn-ghost rounded-full"
              >
                View / print {formatWeekRange(weekStart)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {requests == null && !error ? <p className="mt-4 text-[var(--muted)]">Loading…</p> : null}
      {requests ? (
        <>
          <section className="mt-4">
            <h2 className="text-lg">Waiting for you ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">No requests waiting.</p>
            ) : (
              <StaggerList className="mt-2 grid gap-3 sm:grid-cols-2">
                {pending.map((request) => (
                  <RequestCard key={request.id} request={request} adminEmail={email} />
                ))}
              </StaggerList>
            )}
          </section>
          {decided.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-lg">Already decided</h2>
              <StaggerList className="mt-2 grid gap-3 sm:grid-cols-2">
                {decided.map((request) => (
                  <RequestCard key={request.id} request={request} adminEmail={email} />
                ))}
              </StaggerList>
            </section>
          ) : null}
        </>
      ) : null}
    </PageFrame>
  );
}
