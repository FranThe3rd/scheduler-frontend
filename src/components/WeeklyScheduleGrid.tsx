"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import type { Employee, ScheduleIssue, Shift, WeekSchedule } from "@/lib/types";
import { shiftDurationHours, todayInNewYork, weekDates } from "@/lib/time";
import { shiftToCellText, type ShiftCellPayload } from "@/lib/shiftCellText";
import {
  buildScheduleGridRows,
  getScheduleCellDisplay,
  shiftsForScheduleCell,
  type ScheduleGridRow,
} from "@/lib/scheduleGridTable";
import { ShiftScheduleDialog } from "@/components/ShiftScheduleDialog";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ShiftKind = "main" | "lehigh" | "ic";

function shiftKind(s: Shift): ShiftKind {
  if (s.location === "lehigh") return "lehigh";
  if (s.department === "ic") return "ic";
  return "main";
}

function shiftIsUncertain(s: Shift): boolean {
  return Boolean(s.notes?.includes("uncertain"));
}

function formatHours(h: number): string {
  if (h <= 0) return "";
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

function dayLabel(date: string): string {
  return format(parseISO(date), "EEE MMM d");
}

function conflictSort(a: ScheduleIssue, b: ScheduleIssue): number {
  return (
    (a.date ?? "").localeCompare(b.date ?? "") || (a.startMinutes ?? 0) - (b.startMinutes ?? 0)
  );
}

export function WeeklyScheduleGrid({
  week,
  employees,
  savingCell,
  onSaveCell,
}: {
  week: WeekSchedule;
  employees: Employee[];
  savingCell: string | null;
  onSaveCell: (args: {
    employeeId: string | null;
    unresolvedLabel?: string;
    date: string;
    shift: ShiftCellPayload | null;
  }) => Promise<void>;
}) {
  const dates = weekDates(week.weekStart);
  const today = todayInNewYork();
  const [filter, setFilter] = useState("");
  const [showConflicts, setShowConflicts] = useState(false);
  const [conflictListOpen, setConflictListOpen] = useState(false);
  /** Shift-type colors (Main / Lehigh / IC) off by default for easier scanning. */
  const [showShiftColors, setShowShiftColors] = useState(false);
  const [editing, setEditing] = useState<{
    row: ScheduleGridRow;
    date: string;
    initialText: string;
    existingShift: Shift | null;
  } | null>(null);

  const allRows = useMemo(
    () => buildScheduleGridRows(employees, week.shifts),
    [employees, week.shifts]
  );
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) => r.label.toLowerCase().includes(q));
  }, [allRows, filter]);

  // Real data derived from the week: weekly hours per row, working headcount per day.
  const hoursByRow = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of week.shifts) {
      const key = s.employeeId ?? `unresolved_${s.unresolvedLabel}`;
      m.set(key, (m.get(key) ?? 0) + shiftDurationHours(s.startMinutes, s.endMinutes));
    }
    return m;
  }, [week.shifts]);

  const workingByDate = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of week.shifts) {
      const key = s.employeeId ?? `unresolved_${s.unresolvedLabel}`;
      if (!m.has(s.date)) m.set(s.date, new Set());
      m.get(s.date)!.add(key);
    }
    return m;
  }, [week.shifts]);

  const conflictsByShift = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const i of week.issues) {
      if (i.severity !== "hard" || !i.shiftId) continue;
      m.set(i.shiftId, [...(m.get(i.shiftId) ?? []), i.message]);
    }
    return m;
  }, [week.issues]);

  const conflicts = useMemo(
    () => [...week.issues.filter((i) => i.severity === "hard")].sort(conflictSort),
    [week.issues]
  );

  function startEdit(row: ScheduleGridRow, date: string, current: string) {
    const cellShifts = shiftsForScheduleCell(
      week.shifts,
      row.employeeId,
      row.employeeId ? undefined : row.label,
      date
    );
    setEditing({
      row,
      date,
      initialText: current === "—" ? "" : current.replace(/\n/g, " / "),
      existingShift: cellShifts[0] ?? null,
    });
  }

  async function commitEdit(row: ScheduleGridRow, date: string, shift: ShiftCellPayload | null) {
    setEditing(null);
    await onSaveCell({
      employeeId: row.employeeId,
      unresolvedLabel: row.employeeId ? undefined : row.label,
      date,
      shift,
    });
  }

  function toggleShowConflicts() {
    setShowConflicts((on) => {
      if (on) setConflictListOpen(false);
      return !on;
    });
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Weekly schedule">
      {/* Filter, legend, issue summary */}
      <div className="no-print flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)] bg-[#f4f6f9] px-3 py-2 text-[12px] text-[var(--muted)] sm:px-4">
        <label className="flex items-center gap-2">
          <span className="sr-only">Filter employees</span>
          <input
            type="search"
            className="input !min-h-7 w-44 !py-0 text-[13px]"
            placeholder="Filter employees"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>

        {showShiftColors ? (
          <ul className="hidden flex-wrap items-center gap-x-3 gap-y-1 lg:flex" aria-label="Legend">
            <li>
              <span className="legend-swatch shift-main" />
              Main
            </li>
            <li>
              <span className="legend-swatch shift-lehigh" />
              Lehigh (L)
            </li>
            <li>
              <span className="legend-swatch shift-ic" />
              Ice cream (IC)
            </li>
            {showConflicts ? (
              <li>
                <span className="legend-swatch border-2 border-[var(--conflict)] bg-white" />
                Conflict
              </li>
            ) : null}
            <li>* time unconfirmed</li>
          </ul>
        ) : (
          <span className="hidden text-[var(--muted)] lg:inline">L / IC shown in cell text</span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="hidden xl:inline">Click a cell to edit</span>
          <button
            type="button"
            className="btn btn-ghost !min-h-7 !text-[12px]"
            aria-pressed={showShiftColors}
            onClick={() => setShowShiftColors((on) => !on)}
          >
            {showShiftColors ? "Plain view" : "Show shift colors"}
          </button>
          {conflicts.length > 0 ? (
            <>
              <button
                type="button"
                className="btn btn-ghost !min-h-7 !text-[12px]"
                aria-pressed={showConflicts}
                onClick={toggleShowConflicts}
              >
                {showConflicts ? "Hide conflicts" : `Show conflicts (${conflicts.length})`}
              </button>
              {showConflicts ? (
                <button
                  type="button"
                  className="btn btn-ghost !min-h-7 !px-2 !text-[12px]"
                  aria-expanded={conflictListOpen}
                  onClick={() => setConflictListOpen((o) => !o)}
                >
                  {conflictListOpen ? "Hide list" : "List"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {showConflicts && conflictListOpen && conflicts.length > 0 ? (
        <div className="issue-list no-print shrink-0">
          <table className="w-full border-collapse">
            <tbody>
              {conflicts.map((i) => (
                <tr key={i.id} className="border-b border-[var(--grid-line)] last:border-0">
                  <td className="w-28 whitespace-nowrap px-3 py-1 text-[var(--muted)]">
                    {i.date ? dayLabel(i.date) : ""}
                  </td>
                  <td className="px-2 py-1">{i.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="sched-scroll min-h-0 flex-1">
        <table className={`sched-table${showShiftColors ? "" : " sched-table--plain"}`}>
          <colgroup>
            <col style={{ width: 172 }} />
            <col style={{ width: 56 }} />
            {dates.map((d) => (
              <col key={d} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sched-corner" scope="col">
                Employee
              </th>
              <th className="sched-hours-head" scope="col">
                Hrs
              </th>
              {dates.map((d, i) => (
                <th
                  key={d}
                  scope="col"
                  className={`${i >= 5 ? "is-weekend" : ""} ${d === today ? "is-today" : ""}`}
                >
                  {DAY_SHORT[i]}
                  <span className="sched-date">{format(parseISO(d), "MMM d")}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="sched-row">
                <th scope="row" className="sched-name" title={row.label}>
                  {row.label}
                </th>
                <td className="sched-hours">{formatHours(hoursByRow.get(row.key) ?? 0)}</td>
                {dates.map((date, di) => {
                  const cellShifts = shiftsForScheduleCell(
                    week.shifts,
                    row.employeeId,
                    row.employeeId ? undefined : row.label,
                    date
                  );
                  const display = getScheduleCellDisplay(week, row, date, week.shifts);
                  const isSaving = savingCell === `${row.key}|${date}`;
                  const conflictMsgs = cellShifts.flatMap((s) => conflictsByShift.get(s.id) ?? []);
                  const hasConflict = showConflicts && conflictMsgs.length > 0;
                  const unclear = cellShifts.length === 0 && display === "Unclear";
                  const empty = cellShifts.length === 0 && !unclear;

                  return (
                    <td
                      key={date}
                      className={`sched-cell-td ${di >= 5 ? "is-weekend" : ""} ${
                        date === today ? "is-today" : ""
                      } ${hasConflict ? "has-conflict" : ""} ${empty ? "sched-empty" : ""}`}
                      title={hasConflict ? conflictMsgs.join("\n") : undefined}
                    >
                      {hasConflict ? (
                        <span className="conflict-mark" aria-hidden>
                          !
                        </span>
                      ) : null}
                      <button
                        type="button"
                        disabled={isSaving}
                        aria-label={`${row.label}, ${dayLabel(date)}: ${
                          cellShifts.length ? display.replace(/\n/g, ", ") : unclear ? "unclear" : "off"
                        }${hasConflict ? " (conflict)" : ""}`}
                        className={`sched-cell ${empty ? "sched-cell-empty" : ""} ${
                          unclear ? "sched-unclear" : ""
                        }`}
                        onClick={() => startEdit(row, date, display)}
                      >
                        {isSaving ? (
                          <span className="text-[var(--muted)]">Saving…</span>
                        ) : cellShifts.length > 0 ? (
                          cellShifts.map((s) => {
                            const [time, ...rest] = shiftToCellText(s).split(" ");
                            return (
                              <span
                                key={s.id}
                                className={`sched-shift shift-${shiftKind(s)} ${
                                  shiftIsUncertain(s) ? "shift-uncertain" : ""
                                }`}
                              >
                                <span>{time}</span>
                                {rest.length > 0 ? <span className="sched-tag">{rest.join(" ")}</span> : null}
                              </span>
                            );
                          })
                        ) : unclear ? (
                          "Unclear"
                        ) : (
                          "+"
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-[var(--muted)]">
                  No employees match “{filter}”.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td className="sched-name">Working</td>
              <td className="sched-hours" />
              {dates.map((d) => {
                const working = workingByDate.get(d)?.size ?? 0;
                return (
                  <td key={d}>
                    <span className="font-semibold">{working}</span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {editing ? (
        <ShiftScheduleDialog
          key={`${editing.row.key}-${editing.date}-${editing.existingShift?.id ?? "new"}`}
          title={`${editing.row.label} · ${dayLabel(editing.date)}`}
          subtitle="Set hours, main vs Lehigh (L), or IC only when there are no hours on the sheet."
          initialText={editing.initialText}
          existingShift={editing.existingShift}
          onClose={() => setEditing(null)}
          onSave={async (shift) => {
            await commitEdit(editing.row, editing.date, shift);
          }}
        />
      ) : null}
    </section>
  );
}
