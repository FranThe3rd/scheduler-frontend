"use client";

import { format, parseISO } from "date-fns";
import { chipStyle } from "@/components/shiftChip";
import {
  availabilityCellFor,
  availabilityShortLabel,
  shiftAvailabilityConflict,
} from "@/components/availabilityTone";
import { buildShortNames } from "@/lib/displayName";
import { shiftToCellText } from "@/lib/shiftCellText";
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

/**
 * Whole week on one screen: people down the side, Mon–Sun across the top.
 * Used by the manager's Schedule tab (tappable) and the read-only team schedule.
 */
export function CompactWeekGrid({
  dates,
  rows,
  shifts,
  availability,
  selectedDate,
  onCell,
  onDay,
}: {
  dates: string[];
  rows: GridRow[];
  shifts: Shift[];
  /** When set, empty cells show days off / limited hours and clashing shifts are flagged. */
  availability?: WeekAvailability[];
  selectedDate?: string | null;
  /** When set, cells are tappable (add/edit). */
  onCell?: (rowId: string, date: string, cellShifts: Shift[]) => void;
  onDay?: (date: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full table-fixed border-collapse text-center">
        <colgroup>
          <col style={{ width: "4.25rem" }} />
          {dates.map((date) => (
            <col key={date} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
            <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-[var(--muted)]">Employee</th>
            {dates.map((date) => {
              const active = selectedDate === date;
              return (
                <th key={date} className="p-0 text-[11px] font-semibold leading-tight">
                  <button
                    type="button"
                    disabled={!onDay}
                    onClick={() => onDay?.(date)}
                    className={`w-full py-1.5 ${active ? "bg-[var(--chrome)] text-white" : "text-[var(--muted)]"}`}
                  >
                    <span className="block">{format(parseISO(date), "EEEEE")}</span>
                    <span className="block font-normal">{format(parseISO(date), "d")}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--border)] last:border-b-0">
              <th scope="row" className="truncate px-2 py-1 text-left text-[13px] font-semibold">
                {row.name}
              </th>
              {dates.map((date) => {
                const cellShifts = shiftsForRow(shifts, row.id, date);
                const availabilityCell = row.id.startsWith("label:")
                  ? null
                  : availabilityCellFor(availability, row.id, date);
                const availabilityText = availabilityShortLabel(availabilityCell);
                const conflicts = cellShifts.flatMap((shift) => {
                  const reason = shiftAvailabilityConflict(availabilityCell, shift);
                  return reason ? [reason] : [];
                });
                const content = cellShifts.length > 0 ? (
                  <span className="flex w-full flex-col gap-0.5">
                    {cellShifts.map((shift) => {
                      const text = shiftToCellText(shift);
                      const clash = shiftAvailabilityConflict(availabilityCell, shift);
                      return (
                        <span
                          key={shift.id}
                          title={clash ?? undefined}
                          className={`block rounded-md px-px py-1 text-[10px] font-semibold leading-tight break-words ${chipStyle(text)} ${
                            clash ? "ring-2 ring-inset ring-[var(--conflict)]" : ""
                          }`}
                        >
                          {clash ? "! " : ""}
                          {text}
                        </span>
                      );
                    })}
                  </span>
                ) : availabilityText ? (
                  <span
                    className={`block py-1 text-[10px] font-semibold leading-tight ${
                      availabilityText === "Off" ? "text-[#b0545c]" : "text-[#9a7a20]"
                    }`}
                  >
                    {availabilityText}
                  </span>
                ) : (
                  <span className="block py-1 text-[11px] text-[#cfc4b5]">{onCell ? "+" : "·"}</span>
                );
                const availabilityAria = availabilityText
                  ? `, availability ${availabilityText === "Off" ? "off" : availabilityText}`
                  : "";
                const conflictAria = conflicts.length > 0 ? `, conflict: ${conflicts.join("; ")}` : "";
                return (
                  <td key={date} className={`p-0.5 align-middle ${selectedDate === date ? "bg-[#f3ece0]" : ""}`}>
                    {onCell ? (
                      <button
                        type="button"
                        className="flex min-h-9 w-full items-center justify-center rounded-md"
                        aria-label={`${row.name}, ${format(parseISO(date), "EEEE MMM d")}, ${
                          cellShifts.length > 0 ? cellShifts.map(shiftToCellText).join(" and ") : "no shift"
                        }${availabilityAria}${conflictAria}`}
                        onClick={() => onCell(row.id, date, cellShifts)}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="flex min-h-9 items-center justify-center">{content}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--border)] bg-[var(--surface-2)]">
            <th scope="row" className="px-2 py-1.5 text-left text-[11px] font-semibold text-[var(--muted)]">
              Working
            </th>
            {dates.map((date) => (
              <td key={date} className="py-1.5 text-xs font-bold tabular-nums">
                {staffOnDate(shifts, date)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
