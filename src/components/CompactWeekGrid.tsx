"use client";

import { format, parseISO } from "date-fns";
import { shiftPlaceKind, shiftPlaceLabel } from "@/components/shiftChip";
import { WeekBoard } from "@/components/WeekBoard";
import {
  availabilityCellFor,
  shiftAvailabilityConflict,
} from "@/components/availabilityTone";
import { buildShortNames } from "@/lib/displayName";
import { formatShiftTimes } from "@/lib/time";
import type { Employee, Shift, WeekAvailability } from "@/lib/types";

export type GridRow = { id: string; name: string };

/** Distinct people (or unmatched names) working on a date. */
export function staffOnDate(shifts: Shift[], date: string): number {
  const keys = new Set<string>();
  for (const shift of shifts) {
    if (shift.date !== date) continue;
    keys.add(shift.employeeId ?? `label:${shift.unresolvedLabel ?? "unassigned"}`);
  }
  return keys.size;
}

/**
 * Rows for the week grid. With `onlyScheduled`, only people who have a shift this week
 * (plus names written on paper that are not matched to anyone yet).
 */
export function buildGridRows(employees: Employee[], shifts: Shift[], opts: { onlyScheduled?: boolean } = {}): GridRow[] {
  const names = buildShortNames(employees);
  const scheduledIds = new Set(shifts.flatMap((shift) => (shift.employeeId ? [shift.employeeId] : [])));
  const rows: GridRow[] = employees
    .filter((employee) => (opts.onlyScheduled ? scheduledIds.has(employee.id) : employee.status === "active"))
    .map((employee) => ({ id: employee.id, name: names.get(employee.id) ?? employee.displayName }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const labels = [
    ...new Set(shifts.filter((shift) => !shift.employeeId).map((shift) => shift.unresolvedLabel || "Unassigned")),
  ];
  for (const label of labels) rows.push({ id: `label:${label}`, name: label });
  return rows;
}

export function shiftsForRow(shifts: Shift[], rowId: string, date: string): Shift[] {
  return shifts
    .filter((shift) => {
      if (shift.date !== date) return false;
      if (rowId.startsWith("label:")) return !shift.employeeId && (shift.unresolvedLabel || "Unassigned") === rowId.slice(6);
      return shift.employeeId === rowId;
    })
    .sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0));
}

function shiftTimeLabel(shift: Shift): string {
  if (shift.department === "ic" && shift.startMinutes == null && shift.endMinutes == null) return "IC";
  return formatShiftTimes(shift.startMinutes, shift.endMinutes);
}

/**
 * Whole week on one screen: people down the side, Mon–Sun across the top.
 * Same geometry as the availability board. Used by the manager's Schedule tab
 * (tappable) and the read-only team schedule.
 */
export function CompactWeekGrid({
  dates,
  rows,
  shifts,
  availability,
  selectedDate,
  highlightRowId,
  onCell,
  onDay,
  density = "regular",
}: {
  dates: string[];
  rows: GridRow[];
  shifts: Shift[];
  /** When set, clashing shifts are flagged. Availability itself is not drawn in the cell. */
  availability?: WeekAvailability[];
  selectedDate?: string | null;
  /** Logged-in employee row, on the read-only team schedule. */
  highlightRowId?: string | null;
  /** When set, cells are tappable (add/edit). */
  onCell?: (rowId: string, date: string, cellShifts: Shift[]) => void;
  onDay?: (date: string) => void;
  density?: "regular" | "desk";
}) {
  return (
    <WeekBoard
      dates={dates}
      rows={rows}
      selectedDate={selectedDate}
      highlightRowId={highlightRowId}
      onDay={onDay}
      density={density}
      caption="Weekly schedule"
      renderCell={(row, date) => {
        const cellShifts = shiftsForRow(shifts, row.id, date);
        const availabilityCell = row.id.startsWith("label:") ? null : availabilityCellFor(availability, row.id, date);
        const conflicts = cellShifts.flatMap((shift) => {
          const reason = shiftAvailabilityConflict(availabilityCell, shift);
          return reason ? [reason] : [];
        });
        const content =
          cellShifts.length > 0 ? (
            cellShifts.map((shift) => {
              const clash = shiftAvailabilityConflict(availabilityCell, shift);
              return (
                <span
                  key={shift.id}
                  title={clash ?? undefined}
                  className={`shift-pill shift-pill--${shiftPlaceKind(shift)} ${clash ? "shift-pill--clash" : ""}`}
                >
                  <span className="shift-pill-time">{shiftTimeLabel(shift)}</span>
                  <span className="shift-pill-place">{shiftPlaceLabel(shift)}</span>
                </span>
              );
            })
          ) : (
            <span className="week-board-dash" aria-hidden>
              —
            </span>
          );
        const conflictAria = conflicts.length > 0 ? `, conflict: ${conflicts.join("; ")}` : "";
        const label = `${row.name}, ${format(parseISO(date), "EEEE MMM d")}, ${
          cellShifts.length > 0
            ? cellShifts.map((shift) => `${shiftTimeLabel(shift)} ${shiftPlaceLabel(shift)}`).join(" and ")
            : "no shift"
        }${conflictAria}`;
        if (onCell) {
          return (
            <button type="button" className="week-board-cell" aria-label={label} onClick={() => onCell(row.id, date, cellShifts)}>
              {content}
            </button>
          );
        }
        return (
          <div className="week-board-cell" aria-label={label}>
            {content}
          </div>
        );
      }}
    />
  );
}
