"use client";

import type {
  Employee,
  Shift,
  WeekSchedule,
  LocationCode,
  Department,
  ReplacementCandidate,
  ScheduleIssue,
} from "@/lib/types";
import {
  weekDates,
  dayOfWeekFromDate,
  formatShiftTimes,
  minutesToLabel,
} from "@/lib/time";
import { shiftCardBackground, shiftColorLegendEntries } from "@/lib/shiftColors";
import { Clock, MoreHorizontal, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { DailyCoverageRecap } from "@/components/DailyCoverageRecap";
import { formatCompactEmployeeName } from "@/lib/displayName";

function LocationBadges({
  loc,
  dept,
}: {
  loc: LocationCode;
  dept: Department;
}) {
  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      {loc === "lehigh" ? (
        <span className="rounded border border-[#1e5a8a] bg-[#1e5a8a] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          Lehi
        </span>
      ) : loc === "linden" ? (
        <span className="rounded border border-[#5a6b4a] bg-transparent px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#3d4a32]">
          Main
        </span>
      ) : null}
      {dept === "ic" ? (
        <span className="rounded bg-[#4b5563] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          IC
        </span>
      ) : null}
    </span>
  );
}

function shiftSortKey(s: Shift): [number, number, string] {
  return [
    s.startMinutes ?? 9999,
    s.endMinutes ?? 9999,
    s.employeeId ?? s.id,
  ];
}

function compareShifts(a: Shift, b: Shift): number {
  const [as, ae, aid] = shiftSortKey(a);
  const [bs, be, bid] = shiftSortKey(b);
  return as - bs || ae - be || aid.localeCompare(bid);
}

function minutesToTimeInput(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return "";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function timeInputToMinutes(v: string): number | null {
  if (!v) return null;
  const [h, m] = v.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function countUnresolvedWarnings(week: WeekSchedule): {
  hard: number;
  shortages: number;
  availability: number;
  location: number;
  total: number;
} {
  const hard = week.issues.filter((i) => i.severity === "hard").length;
  const shortages = week.issues.filter((i) => i.severity === "shortage").length;
  const availability = week.issues.filter((i) => i.code === "unconfirmed_availability").length;
  const location = week.issues.filter((i) => i.code === "unknown_location").length;
  return {
    hard,
    shortages,
    availability,
    location,
    total: hard + shortages + availability + location,
  };
}

export function ScheduleCard({
  week,
  employees,
  onUpsert,
  onDelete,
  onRebuild,
  onStartOver,
  onApprove,
  onFetchCandidates,
}: {
  week: WeekSchedule;
  employees: Employee[];
  onUpsert: (shift: Partial<Shift> & { date: string }) => Promise<void>;
  onDelete: (shiftId: string) => Promise<void>;
  onRebuild: () => void;
  onStartOver: () => void;
  onApprove: (acknowledgeIncomplete?: boolean) => Promise<void>;
  onFetchCandidates: (issue: ScheduleIssue) => Promise<ReplacementCandidate[]>;
}) {
  const dates = weekDates(week.weekStart);
  const [edit, setEdit] = useState<(Partial<Shift> & { date: string }) | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [candidates, setCandidates] = useState<ReplacementCandidate[] | null>(null);
  const [candidateIssue, setCandidateIssue] = useState<ScheduleIssue | null>(null);
  const [ackOpen, setAckOpen] = useState(false);

  const empMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees]
  );

  const counts = countUnresolvedWarnings(week);
  const noCalendar = !week.explanation.availabilityCalendarEntered;

  const statusLabel =
    week.status === "approved"
      ? "Approved"
      : counts.hard > 0
        ? "Needs fixes"
        : noCalendar
          ? "Provisional draft — availability not confirmed"
          : counts.total > 0
            ? "Draft with warnings"
            : "Draft ready";

  const totalHours = week.totals.reduce((s, t) => s + t.hours, 0);

  async function saveEdit() {
    if (!edit?.date) return;
    await onUpsert(edit);
    setEdit(null);
  }

  async function tryApprove() {
    try {
      await onApprove(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("ACK") || msg.includes("acknowledge")) {
        setAckOpen(true);
      } else {
        alert(msg || "Could not approve");
      }
    }
  }

  const hardConflicts = week.issues.filter((i) => i.severity === "hard");
  const shortDays = new Set(
    week.coverage.filter((c) => c.status !== "no_target" && c.count < c.minimum).map((c) => c.date)
  ).size;

  return (
    <section className="card mx-auto max-w-6xl px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">Weekly schedule.</h2>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                week.status === "approved"
                  ? "bg-[var(--bg-accent)] text-[var(--forest)]"
                  : counts.hard > 0 || noCalendar || counts.total > 0
                    ? "bg-[var(--pink-off)] text-[#8a3b45]"
                    : "bg-[var(--bg)] text-[var(--muted)]"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {week.shifts.length} shifts · {totalHours.toFixed(1)} staff hours
            {shortDays > 0 ? ` · ${shortDays} day${shortDays === 1 ? "" : "s"} need attention` : ""}
            {counts.hard > 0 ? ` · ${counts.hard} hard conflict${counts.hard === 1 ? "" : "s"}` : ""}
            {week.buildMeta
              ? ` · built in ${(week.buildMeta.durationMs / 1000).toFixed(1)}s`
              : ""}
          </p>
        </div>
        <div className="relative flex gap-2">
          <Link
            href={`/print/${week.weekStart}`}
            className="btn btn-ghost !min-h-11 !px-3"
            target="_blank"
          >
            <Printer size={18} />
          </Link>
          <button
            type="button"
            className="btn btn-ghost !min-h-11 !px-3"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 z-10 w-56 rounded-xl border border-[var(--border)] bg-white p-2 shadow-lg">
              <button
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--bg)]"
                onClick={() => {
                  setMenuOpen(false);
                  onRebuild();
                }}
              >
                Rebuild unlocked shifts
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="mt-4 flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[11px] text-[var(--text)]"
        aria-label="Shift color legend"
      >
        <span className="w-full font-semibold text-[var(--muted)]">Colors by exact shift times:</span>
        {shiftColorLegendEntries(week.shifts)
          .filter((e) =>
            week.shifts.some(
              (s) =>
                s.startMinutes != null &&
                s.endMinutes != null &&
                `${s.startMinutes}-${s.endMinutes}` === e.key
            )
          )
          .map(({ key, label, color }) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-3.5 w-3.5 rounded-sm border border-[var(--border)]"
                style={{ background: color }}
                aria-hidden
              />
              {label}
            </span>
          ))}
        <span className="ml-auto inline-flex items-center gap-2 text-[10px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="rounded border border-[#1e5a8a] bg-[#1e5a8a] px-1 text-[8px] font-bold text-white">
              Lehi
            </span>
            location
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="rounded bg-[#4b5563] px-1 text-[8px] font-bold text-white">IC</span>
            dept
          </span>
        </span>
      </div>

      <div className="table-scroll mt-4">
        <div className="flex min-w-[900px] gap-2">
          {dates.map((d) => {
            const dayShifts = week.shifts.filter((s) => s.date === d);
            const lehigh = dayShifts
              .filter((s) => s.location === "lehigh")
              .sort(compareShifts);
            const main = dayShifts
              .filter((s) => s.location === "linden")
              .sort(compareShifts);
            const other = dayShifts
              .filter((s) => s.location !== "lehigh" && s.location !== "linden")
              .sort(compareShifts);

            function renderShift(s: Shift) {
              const emp = s.employeeId ? empMap[s.employeeId] : undefined;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`rounded-xl border p-2 text-left shadow-sm ${
                    s.location === "lehigh"
                      ? "border-[#1e5a8a] border-l-[3px]"
                      : "border-[var(--border)]"
                  }`}
                  style={{ background: shiftCardBackground(s), color: "#1a1a1a" }}
                  onClick={() => setEdit({ ...s })}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="text-xs font-bold leading-tight">
                      {emp
                        ? formatCompactEmployeeName(emp)
                        : s.unresolvedLabel ?? "Unresolved"}
                    </div>
                    <LocationBadges loc={s.location} dept={s.department} />
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-medium">
                    <Clock size={11} />
                    {formatShiftTimes(s.startMinutes, s.endMinutes)}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium text-[var(--muted)]">
                    {s.location === "unknown" ? "Location?" : ""}
                    {s.locked ? " · Locked" : ""}
                    {s.provisionalAvailability ? " · Check avail." : ""}
                  </div>
                </button>
              );
            }

            return (
              <div key={d} className="w-[128px] shrink-0">
                <div className="mb-2 rounded-xl bg-[var(--bg)] px-2 py-2 text-center">
                  <div className="text-xs font-semibold capitalize text-[var(--muted)]">
                    {dayOfWeekFromDate(d)}
                  </div>
                  <div className="text-sm font-bold">{d.slice(5).replace("-", "/")}</div>
                </div>
                <div className="flex flex-col gap-2">
                  {lehigh.length > 0 ? (
                    <>
                      <div className="px-0.5 text-[9px] font-bold uppercase tracking-wide text-[#1e5a8a]">
                        Lehi
                      </div>
                      {lehigh.map(renderShift)}
                    </>
                  ) : null}
                  {main.length > 0 ? (
                    <>
                      <div className="px-0.5 text-[9px] font-bold uppercase tracking-wide text-[#3d4a32]">
                        Main
                      </div>
                      {main.map(renderShift)}
                    </>
                  ) : null}
                  {other.map(renderShift)}
                  <button
                    type="button"
                    className="rounded-xl border border-dashed border-[var(--border)] py-3 text-sm text-[var(--muted)]"
                    onClick={() =>
                      setEdit({
                        date: d,
                        employeeId: employees.find((e) => e.status === "active")?.id ?? null,
                        startMinutes: 18 * 60,
                        endMinutes: 22 * 60,
                        location: "unknown",
                        department: "floor",
                        locked: false,
                      })
                    }
                  >
                    + Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn btn-ghost" onClick={onStartOver}>
          Start over
        </button>
        <button
          type="button"
          className="btn btn-forest flex-1 sm:flex-none sm:min-w-[220px]"
          onClick={() => void tryApprove()}
        >
          Approve & export
        </button>
      </div>

      {hardConflicts.length > 0 && (
        <div className="mt-4 space-y-2">
          {hardConflicts.slice(0, 8).map((issue) => (
            <div
              key={issue.id}
              className="rounded-2xl border border-[#e8a0a8] bg-[var(--pink-off)] p-3 text-sm text-[#8a3b45]"
            >
              <span className="font-semibold">Hard conflict · </span>
              {issue.message}
            </div>
          ))}
        </div>
      )}

      <DailyCoverageRecap week={week} employees={employees} />

      {edit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-4">
            <h3 className="font-bold">{edit.id ? "Edit shift" : "Add shift"}</h3>
            <label className="mt-3 block text-sm font-semibold">Employee</label>
            <select
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-3"
              value={edit.employeeId ?? ""}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  employeeId: e.target.value || null,
                  unresolvedLabel: undefined,
                })
              }
            >
              <option value="">Unresolved / choose…</option>
              {employees
                .filter((e) => e.status === "active")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {formatCompactEmployeeName(e)}
                  </option>
                ))}
            </select>
            <label className="mt-3 block text-sm font-semibold">Date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-3"
              value={edit.date}
              onChange={(e) => setEdit({ ...edit, date: e.target.value })}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-semibold">Start</label>
                <input
                  type="time"
                  step={1800}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-3"
                  value={minutesToTimeInput(edit.startMinutes)}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      startMinutes: timeInputToMinutes(e.target.value),
                    })
                  }
                />
                <div className="text-xs text-[var(--muted)]">
                  {edit.startMinutes != null ? minutesToLabel(edit.startMinutes) : "—"}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold">End</label>
                <input
                  type="time"
                  step={1800}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-3"
                  value={minutesToTimeInput(edit.endMinutes)}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      endMinutes: timeInputToMinutes(e.target.value),
                    })
                  }
                />
                <div className="text-xs text-[var(--muted)]">
                  {edit.endMinutes != null ? minutesToLabel(edit.endMinutes) : "—"}
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                [9 * 60, 13 * 60, "9–1"],
                [11 * 60, 15 * 60, "11–3"],
                [12 * 60, 15 * 60, "12–3"],
                [12 * 60, 16 * 60, "12–4"],
                [12 * 60, 18 * 60, "12–6"],
                [13 * 60, 18 * 60, "1–6"],
                [15 * 60, 18 * 60, "3–6"],
                [15 * 60, 22 * 60, "3–10"],
                [16 * 60, 22 * 60, "4–10"],
                [17 * 60, 19 * 60, "5–7"],
                [18 * 60, 22 * 60, "6–10"],
                [19 * 60, 22 * 60, "7–10"],
              ].map(([a, b, label]) => (
                <button
                  key={String(label)}
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                  style={{
                    background: shiftCardBackground({
                      startMinutes: Number(a),
                      endMinutes: Number(b),
                      department: "floor",
                    }),
                    color: "#1a1a1a",
                  }}
                  onClick={() =>
                    setEdit({ ...edit, startMinutes: Number(a), endMinutes: Number(b) })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm font-semibold">Location</label>
            <select
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-3"
              value={edit.location ?? "unknown"}
              onChange={(e) =>
                setEdit({ ...edit, location: e.target.value as LocationCode })
              }
            >
              <option value="unknown">Unknown (confirm later)</option>
              <option value="linden">Main</option>
              <option value="lehigh">Lehi (L)</option>
            </select>
            <label className="mt-3 block text-sm font-semibold">Department</label>
            <select
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-3"
              value={edit.department ?? "floor"}
              onChange={(e) =>
                setEdit({ ...edit, department: e.target.value as Department })
              }
            >
              <option value="floor">Store floor</option>
              <option value="ic">Ice cream (IC)</option>
            </select>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(edit.locked)}
                onChange={(e) => setEdit({ ...edit, locked: e.target.checked })}
              />
              Lock this shift (kept when rebuilding)
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-forest flex-1" onClick={() => void saveEdit()}>
                Save
              </button>
              {edit.id && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={async () => {
                    await onDelete(edit.id!);
                    setEdit(null);
                  }}
                >
                  Delete
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {candidates && candidateIssue && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto p-4">
            <h3 className="font-bold">Who Mike could call</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{candidateIssue.message}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              No messages are sent automatically.
            </p>
            <div className="mt-3 space-y-2">
              {candidates.length === 0 && (
                <p className="text-sm">No eligible candidates for this slot.</p>
              )}
              {candidates.map((c) => (
                <div key={c.employeeId} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="font-semibold">{c.displayName}</div>
                  <div className="text-xs font-medium text-[var(--forest)]">
                    {c.status === "confirmed_available"
                      ? "Confirmed available"
                      : "Availability needs check"}
                  </div>
                  <div className="text-xs text-[var(--muted)]">{c.reason}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost mt-4 w-full"
              onClick={() => {
                setCandidates(null);
                setCandidateIssue(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {ackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="card w-full max-w-md p-4">
            <h3 className="font-bold">Approve incomplete schedule?</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              There are still coverage shortages, unknown locations, or assignments with
              unconfirmed availability. Approve anyway?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn btn-forest flex-1"
                onClick={async () => {
                  setAckOpen(false);
                  await onApprove(true);
                }}
              >
                Yes, approve
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setAckOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
