"use client";

import type { AvailabilityCell, Employee, WeekSchedule } from "@/lib/types";
import { dayOfWeekFromDate, weekDates } from "@/lib/time";
import { formatCompactEmployeeName } from "@/lib/displayName";

/**
 * Compact employee × day sign-off grid.
 * Blank = no full-day sign-off (usual windows still apply).
 * X = full-day signed off.
 * Exception marker = partial-day / unclear note stored on the cell.
 */
export function SignOffGrid({
  week,
  employees,
  onToggleOff,
  onOpenException,
  generating,
  onGenerate,
  canGenerate,
  generateBlockedReason,
}: {
  week: WeekSchedule;
  employees: Employee[];
  onToggleOff: (employeeId: string, date: string) => void;
  onOpenException?: (employeeId: string, date: string) => void;
  generating: boolean;
  onGenerate: () => void;
  canGenerate: boolean;
  generateBlockedReason?: string;
}) {
  const dates = weekDates(week.weekStart);
  const active = employees
    .filter((e) => e.status === "active")
    .sort((a, b) =>
      formatCompactEmployeeName(a).localeCompare(formatCompactEmployeeName(b))
    );

  function cellFor(employeeId: string, date: string): AvailabilityCell {
    const row = week.availability.find((a) => a.employeeId === employeeId);
    return row?.cells[date] ?? { kind: "empty" };
  }

  function isFullDayOff(cell: AvailabilityCell): boolean {
    return cell.kind === "off";
  }

  function hasException(cell: AvailabilityCell): boolean {
    // Recurring usual windows are not sign-off exceptions — keep the grid blank/X only.
    if (cell.source === "recurring") return false;
    return (
      cell.kind === "after" ||
      cell.kind === "until" ||
      cell.kind === "window" ||
      cell.kind === "unclear" ||
      Boolean(cell.needsReview)
    );
  }

  return (
    <section className="card mx-auto max-w-6xl px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Who&apos;s off?</h2>
          <p className="text-xs text-[var(--muted)]">
            Tap a cell to toggle <strong>X</strong> (off all day). Empty cells mean no sign-off
            recorded.
          </p>
        </div>
      </div>

      <div className="table-scroll mt-3 rounded-lg border border-[var(--border)]">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--bg)]">
              <th className="sticky-col min-w-[140px] px-2 py-1.5 text-left text-xs font-semibold">
                Employee
              </th>
              {dates.map((d) => (
                <th key={d} className="min-w-[72px] px-1 py-1.5 text-center text-xs font-semibold">
                  <div className="capitalize">{dayOfWeekFromDate(d).slice(0, 3)}</div>
                  <div className="font-normal text-[var(--muted)]">
                    {d.slice(5).replace("-", "/")}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.map((emp) => (
              <tr key={emp.id} className="border-t border-[var(--border)]">
                <td className="sticky-col px-2 py-0.5 text-sm font-medium leading-tight">
                  {formatCompactEmployeeName(emp)}
                </td>
                {dates.map((d) => {
                  const cell = cellFor(emp.id, d);
                  const off = isFullDayOff(cell);
                  const exc = hasException(cell) && !off;
                  return (
                    <td key={d} className="p-0.5">
                      <button
                        type="button"
                        className={`relative flex h-7 w-full items-center justify-center rounded text-sm font-bold ${
                          off
                            ? "bg-[var(--pink-off)] text-[#8a3b45]"
                            : "bg-white text-[var(--muted)] hover:bg-[var(--icy)]"
                        }`}
                        aria-label={`${formatCompactEmployeeName(emp)} ${d} ${off ? "signed off" : "no sign-off"}`}
                        onClick={() => onToggleOff(emp.id, d)}
                        onContextMenu={(e) => {
                          if (!onOpenException) return;
                          e.preventDefault();
                          onOpenException(emp.id, d);
                        }}
                      >
                        {off ? "X" : ""}
                        {exc ? (
                          <span
                            className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[#8a4b2a]"
                            title={cell.note ?? "Exception"}
                          />
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="btn btn-terracotta mt-4 w-full text-base"
        disabled={generating || !canGenerate}
        onClick={onGenerate}
      >
        {generating ? "Generating schedule…" : "Generate schedule"}
      </button>
      {!canGenerate && generateBlockedReason ? (
        <p className="mt-2 text-center text-sm text-[#8a4b2a]">{generateBlockedReason}</p>
      ) : null}
    </section>
  );
}
