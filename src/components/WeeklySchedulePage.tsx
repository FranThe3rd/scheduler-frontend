"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { CompactWeekGrid, buildGridRows } from "@/components/CompactWeekGrid";
import { CoverageCheck } from "@/components/CoverageCheck";
import { PageFrame } from "@/components/PageFrame";
import { ScheduleCopyPaste } from "@/components/ScheduleCopyPaste";
import { ScheduleExportButtons } from "@/components/ScheduleExportButtons";
import { coverageGapSummaries } from "@/components/ShiftCoverageRecap";
import { ShiftScheduleDialog } from "@/components/ShiftScheduleDialog";
import type { Employee, Shift, StaffingIntervalTarget, WeekSchedule } from "@/lib/types";
import { apiFetch } from "@/lib/api/client";
import { isIcOnlyPayload, shiftToCellText, type ShiftCellPayload } from "@/lib/shiftCellText";
import { buildShortNames, formatCompactEmployeeName } from "@/lib/displayName";
import { useToday } from "@/components/useClientSession";
import { useAdminWeek } from "@/components/useAdminWeek";
import { useAuth } from "@/components/AuthProvider";
import {
  availabilityCellFor,
  cellDetail,
  toneForCell,
  toneLabel,
} from "@/components/availabilityTone";
import { formatWeekRange, newId, weekDates } from "@/lib/time";

type Bootstrap = {
  employees: Employee[];
  week: WeekSchedule;
  staffingTargets: StaffingIntervalTarget[];
};

export function WeeklySchedulePage() {
  const { rosterVersion, schedulerVersion } = useAuth();
  const [weekStart, setWeekStart] = useAdminWeek();
  const today = useToday();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [needsAck, setNeedsAck] = useState(false);
  const [approving, setApproving] = useState(false);
  const [addEmployeeId, setAddEmployeeId] = useState("");
  const [adding, setAdding] = useState(false);
  const [draftText, setDraftText] = useState("");
  const weekRequestRef = useRef<string | null>(null);

  const loadWeek = useCallback(async (week: string) => {
    const res = await apiFetch(`/api/bootstrap?week=${encodeURIComponent(week)}&mode=shell`);
    if (weekRequestRef.current !== week) return;
    if (!res.ok) {
      setError("Could not load schedule.");
      return;
    }
    const json = (await res.json()) as Bootstrap;
    if (weekRequestRef.current !== week) return;
    setError(null);
    setData({
      employees: json.employees,
      week: json.week,
      staffingTargets: json.staffingTargets ?? [],
    });
  }, []);

  useEffect(() => {
    if (!weekStart) return;
    const requested = weekStart;
    weekRequestRef.current = requested;
    let cancelled = false;
    void apiFetch(`/api/bootstrap?week=${encodeURIComponent(requested)}&mode=shell`).then(async (res) => {
      if (cancelled || weekRequestRef.current !== requested) return;
      if (!res.ok) {
        setError("Could not load schedule.");
        return;
      }
      const json = (await res.json()) as Bootstrap;
      if (cancelled || weekRequestRef.current !== requested) return;
      setError(null);
      setData({
        employees: json.employees,
        week: json.week,
        staffingTargets: json.staffingTargets ?? [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [weekStart, rosterVersion, schedulerVersion]);

  /**
   * Save one shift. With `replaceShiftId` that single shift is replaced (or removed when
   * `shift` is null); without it a new shift is added. Nothing else is touched.
   */
  async function saveShift(args: {
    employeeId: string | null;
    unresolvedLabel?: string;
    date: string;
    shift: ShiftCellPayload | null;
    replaceShiftId?: string;
  }) {
    if (!weekStart || !data) return;
    setError(null);

    try {
      let weekAfterDeletes = data.week;
      if (args.replaceShiftId) {
        const res = await apiFetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart, action: "delete", shiftId: args.replaceShiftId }),
        });
        const delJson = (await res.json()) as { week?: WeekSchedule; error?: string };
        if (!res.ok) throw new Error(delJson.error ?? "Could not update shift");
        if (delJson.week) weekAfterDeletes = delJson.week;
      }

      if (args.shift) {
        const icOnly = isIcOnlyPayload(args.shift);
        const shift: Partial<Shift> & { date: string } = {
          id: newId("shift"),
          employeeId: args.employeeId,
          unresolvedLabel: args.employeeId ? undefined : args.unresolvedLabel,
          date: args.date,
          startMinutes: icOnly ? null : args.shift.startMinutes,
          endMinutes: icOnly ? null : args.shift.endMinutes,
          location: args.shift.location === "lehigh" ? "lehigh" : "linden",
          department: args.shift.department === "ic" ? "ic" : "floor",
          notes: icOnly ? "IC" : args.shift.uncertain ? "uncertain" : undefined,
          locked: false,
          source: "manual",
        };
        const res = await apiFetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart, action: "upsert", shift }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not save shift");
        setData((prev) => (prev ? { ...prev, week: json.week } : prev));
      } else {
        setData((prev) => (prev ? { ...prev, week: weekAfterDeletes } : prev));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function approve(acknowledgeIncomplete = false) {
    if (!weekStart) return;
    setApproving(true);
    setApproveError(null);
    const res = await apiFetch("/api/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, action: "approve", acknowledgeIncomplete }),
    });
    const json = await res.json();
    if (res.status === 409) {
      setNeedsAck(true);
      setApproveError(json.error || "Schedule has unresolved issues.");
      if (json.week) setData((prev) => (prev ? { ...prev, week: json.week } : prev));
    } else if (!res.ok) {
      setApproveError(json.error || "Could not publish this schedule.");
    } else {
      setNeedsAck(false);
      setData((prev) => (prev ? { ...prev, week: json.week } : prev));
    }
    setApproving(false);
  }

  const shifts = useMemo(() => data?.week.shifts ?? [], [data]);
  const isPosted = data?.week.status === "approved" || data?.week.status === "confirmed_worked";
  const dates = data ? weekDates(data.week.weekStart) : [];
  const activeDay = day && dates.includes(day) ? day : today && dates.includes(today) ? today : (dates[0] ?? null);
  const roster = useMemo(
    () =>
      (data?.employees ?? [])
        .filter((employee) => employee.status === "active")
        .sort((a, b) => formatCompactEmployeeName(a).localeCompare(formatCompactEmployeeName(b))),
    [data]
  );
  const names = useMemo(() => buildShortNames(data?.employees ?? []), [data]);
  const rows = useMemo(() => buildGridRows(roster, shifts), [roster, shifts]);

  const nameOf = useCallback(
    (shift: Shift): string => {
      if (shift.employeeId) return names.get(shift.employeeId) ?? shift.employeeId;
      return shift.unresolvedLabel || "Unassigned";
    },
    [names]
  );

  const availability = data?.week.availability;
  function availabilityNote(employeeId: string | null, date: string): string {
    const cell = availabilityCellFor(availability, employeeId, date);
    const tone = toneForCell(cell);
    if (tone === "unset") return "";
    if (tone === "available") return "Availability: available";
    return `Availability: ${toneLabel(tone).toLowerCase()} (${cellDetail(cell)})`;
  }
  function dialogSubtitle(employeeId: string | null, date: string): string {
    const note = availabilityNote(employeeId, date);
    const day = format(parseISO(date), "EEEE, MMM d");
    return note ? `${day} · ${note}` : day;
  }
  if (!weekStart) {
    return (
      <PageFrame>
        <p className="text-[var(--muted)]">Loading…</p>
      </PageFrame>
    );
  }

  const weekTotalShifts = shifts.length;

  return (
    <PageFrame>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-[1.85rem] leading-none sm:text-[2rem]">
            Weekly schedule
            <span className={isPosted ? "tag tag-published" : "tag tag-draft"}>{isPosted ? "Published" : "Draft"}</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Assign shifts and locations. Review coverage before publishing.</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--surface-2)]"
            aria-label="Previous week"
            onClick={() => setWeekStart(format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd"))}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-1 text-sm font-semibold">{formatWeekRange(weekStart)}</span>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--surface-2)]"
            aria-label="Next week"
            onClick={() => setWeekStart(format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd"))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--conflict)]">
          {error}
        </p>
      ) : null}
      {approveError ? (
        <p role="alert" className="mt-2 text-sm text-[var(--warn-text)]">
          {approveError}{" "}
          {needsAck ? (
            <button type="button" className="font-semibold underline" onClick={() => void approve(true)}>
              Publish anyway
            </button>
          ) : null}
        </p>
      ) : null}
      {!data || !activeDay ? (
        <p className="mt-4 text-[var(--muted)]">Loading schedule…</p>
      ) : (
        <>
          {roster.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-[var(--surface)] px-3 py-3 text-sm">
              No staff yet. Employees show up here automatically after they sign in with Google.
            </p>
          ) : null}

          <div className="mt-4">
            <div className="min-w-0">
              <CompactWeekGrid
                dates={dates}
                rows={rows}
                shifts={shifts}
                availability={data.week.availability}
                selectedDate={activeDay}
                density="desk"
                onDay={setDay}
                onCell={(rowId, date, cellShifts) => {
                  setDay(date);
                  if (rowId.startsWith("label:")) {
                    if (cellShifts.length === 1) setEditing(cellShifts[0]!);
                    return;
                  }
                  setAddEmployeeId(rowId);
                  if (cellShifts.length === 1) {
                    setAdding(false);
                    setEditing(cellShifts[0]!);
                  } else if (cellShifts.length === 0) {
                    setEditing(null);
                    setDraftText("");
                    setAdding(true);
                  }
                }}
              />
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]" aria-label="Shift legend">
                <li className="flex items-center gap-1.5">
                  <span className="legend-dot shift-pill--linden" /> Linden
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="legend-dot shift-pill--lehigh" /> Lehigh
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="legend-dot shift-pill--ic" /> Ice cream
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="legend-dot ring-2 ring-inset ring-[var(--conflict)]" /> Clashes with availability
                </li>
              </ul>
              {weekTotalShifts === 0 ? (
                <p className="mt-3 rounded-2xl bg-[var(--surface)] px-3 py-3 text-sm text-[var(--muted)]">
                  Nothing scheduled yet. Select an empty day to give someone a shift.
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Coverage summary</p>
                  {(() => {
                    const lines = coverageGapSummaries(data.week, data.employees, data.staffingTargets);
                    const shortDays = new Set(lines.map((line) => line.split(" · ")[0])).size;
                    return (
                      <p className={`mt-1 text-sm ${shortDays > 0 ? "font-semibold text-[var(--signoff-fg)]" : ""}`}>
                        {shortDays === 0
                          ? weekTotalShifts === 0
                            ? "No shifts yet"
                            : "No gaps against the usual targets."
                          : `${shortDays} ${shortDays === 1 ? "day is" : "days are"} short`}
                      </p>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ScheduleCopyPaste weekStart={weekStart} week={data.week} onApplied={() => void loadWeek(weekStart)} />
                  <Link href={`/print/${weekStart}`} className="btn btn-ghost h-11">
                    <Printer size={15} />
                    Print / PDF
                  </Link>
                  <button type="button" className="btn btn-primary h-11 px-5" disabled={approving} onClick={() => void approve(false)}>
                    {approving ? "Publishing…" : isPosted ? "Publish changes" : "Approve & publish"}
                  </button>
                </div>
              </div>
              <div className="mt-2">
                <ScheduleExportButtons week={data.week} employees={data.employees} variant="link" />
              </div>
            </div>

            <CoverageCheck
              week={data.week}
              employees={data.employees}
              targets={data.staffingTargets}
            />
          </div>
        </>
      )}
      {editing ? (
        <ShiftScheduleDialog
          key={`edit-${editing.id}`}
          title={nameOf(editing)}
          subtitle={dialogSubtitle(editing.employeeId, editing.date)}
          initialText={shiftToCellText(editing)}
          existingShift={editing}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            await saveShift({
              employeeId: editing.employeeId,
              unresolvedLabel: editing.unresolvedLabel,
              date: editing.date,
              shift: payload,
              replaceShiftId: editing.id,
            });
            setEditing(null);
          }}
        />
      ) : null}
      {adding && addEmployeeId && activeDay ? (
        <ShiftScheduleDialog
          key={`add-${addEmployeeId}-${activeDay}`}
          title={roster.find((employee) => employee.id === addEmployeeId)?.displayName ?? "New shift"}
          subtitle={dialogSubtitle(addEmployeeId, activeDay)}
          initialText={draftText}
          onClose={() => setAdding(false)}
          onSave={async (payload) => {
            await saveShift({
              employeeId: addEmployeeId,
              date: activeDay,
              shift: payload,
            });
            setAdding(false);
          }}
        />
      ) : null}
    </PageFrame>
  );
}
