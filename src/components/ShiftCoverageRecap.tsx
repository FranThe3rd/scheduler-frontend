"use client";

import { format, parseISO } from "date-fns";
import { formatCompactEmployeeName } from "@/lib/displayName";
import { formatShiftCellCompact } from "@/lib/shiftCellText";
import { minutesToLabel, weekDates } from "@/lib/time";
import { revalidateWeek } from "@/lib/validation";
import type { CoverageIntervalResult, Employee, Shift, StaffingIntervalTarget, WeekSchedule } from "@/lib/types";

type Location = "linden" | "lehigh";

const LOCATIONS: Array<{ id: Location; name: string }> = [
  { id: "linden", name: "Main" },
  { id: "lehigh", name: "Lehi" },
];

function rangeLabel(start: number, end: number): string {
  if (start % 60 === 0 && end % 60 === 0) return formatShiftCellCompact(start, end);
  return `${minutesToLabel(start)}–${minutesToLabel(end)}`;
}

type Gap = { start: number; end: number; have: number; need: number };

/** Merge neighbouring under-staffed intervals into readable gaps. */
function gapsFor(rows: CoverageIntervalResult[]): Gap[] {
  const short = rows
    .filter((row) => row.department === "floor")
    .filter((row) => row.status === "below_minimum" || row.status === "unstaffed_open")
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const gaps: Gap[] = [];
  for (const row of short) {
    const last = gaps[gaps.length - 1];
    const need = Math.max(row.minimum, 1);
    if (last && last.end === row.startMinutes && last.have === row.count && last.need === need) {
      last.end = row.endMinutes;
      continue;
    }
    gaps.push({ start: row.startMinutes, end: row.endMinutes, have: row.count, need });
  }
  return gaps;
}

/**
 * Simple per-day recap of the posted shifts: for each shift block, the hours and
 * how many people are on it, plus any hours where staffing is under the target.
 */
export function ShiftCoverageRecap({
  week,
  employees,
  targets,
}: {
  week: WeekSchedule;
  employees: Employee[];
  targets: StaffingIntervalTarget[];
}) {
  const dates = weekDates(week.weekStart);
  const nameOf = (shift: Shift) => {
    if (shift.employeeId) {
      const employee = employees.find((item) => item.id === shift.employeeId);
      return employee ? formatCompactEmployeeName(employee) : "Unknown";
    }
    return shift.unresolvedLabel || "Unassigned";
  };

  const coverage =
    week.coverage.length > 0
      ? week.coverage
      : revalidateWeek({
          shifts: week.shifts,
          availability: week.availability,
          employees,
          targets,
          weekStart: week.weekStart,
        }).coverage;

  const days = dates.map((date) => {
    const dayShifts = week.shifts.filter((shift) => shift.date === date);
    const locations = LOCATIONS.map(({ id, name }) => {
      const blocks = new Map<string, { start: number; end: number; names: string[] }>();
      for (const shift of dayShifts) {
        if (shift.department === "ic") continue;
        if ((shift.location === "lehigh" ? "lehigh" : "linden") !== id) continue;
        if (shift.startMinutes == null || shift.endMinutes == null) continue;
        const key = `${shift.startMinutes}-${shift.endMinutes}`;
        const block = blocks.get(key) ?? { start: shift.startMinutes, end: shift.endMinutes, names: [] };
        block.names.push(nameOf(shift));
        blocks.set(key, block);
      }
      const sorted = [...blocks.values()].sort((a, b) => a.start - b.start || a.end - b.end);
      const gaps = gapsFor(coverage.filter((row) => row.date === date && row.location === id));
      return { id, name, blocks: sorted, gaps };
    });
    const ic = dayShifts.filter((shift) => shift.department === "ic").map(nameOf);
    const gapCount = locations.reduce((total, location) => total + location.gaps.length, 0);
    return { date, locations, ic, gapCount };
  });

  const gapDays = days.filter((day) => day.gapCount > 0).length;
  const anyShifts = week.shifts.length > 0;

  return (
    <section className="card mt-4 p-4 shadow-none" aria-label="Coverage recap">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg">Coverage recap</h2>
        <p
          className={`text-sm font-semibold ${
            !anyShifts ? "text-[var(--muted)]" : gapDays === 0 ? "text-[#2f6b4f]" : "text-[#8d3d45]"
          }`}
        >
          {!anyShifts ? "No shifts yet" : gapDays === 0 ? "No gaps" : `${gapDays} ${gapDays === 1 ? "day has" : "days have"} gaps`}
        </p>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 lg:grid-cols-3">
        {days.map((day) => (
          <li key={day.date} className="min-w-0 rounded-2xl bg-[var(--surface)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-semibold leading-tight">
                {format(parseISO(day.date), "EEEE")}
                <span className="ml-1.5 text-sm font-normal text-[var(--muted)]">{format(parseISO(day.date), "MMM d")}</span>
              </p>
              {day.gapCount > 0 ? (
                <span className="shrink-0 rounded-full bg-[#f7d6d4] px-2 py-0.5 text-[11px] font-bold text-[#8d3d45]">
                  {day.gapCount} {day.gapCount === 1 ? "gap" : "gaps"}
                </span>
              ) : null}
            </div>
            {day.locations.map((location) => {
              if (location.blocks.length === 0 && location.gaps.length === 0) return null;
              return (
                <div key={location.id} className="mt-3 border-t border-[var(--border)] pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{location.name}</p>
                  <ul className="mt-1.5 space-y-2">
                    {location.blocks.map((block) => (
                      <li key={`${block.start}-${block.end}`} className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-base font-semibold tabular-nums">{rangeLabel(block.start, block.end)}</span>
                          <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums shadow-sm">
                            {block.names.length} {block.names.length === 1 ? "person" : "people"}
                          </span>
                        </div>
                        <p className="mt-0.5 break-words text-xs leading-snug text-[var(--muted)]">{block.names.join(", ")}</p>
                      </li>
                    ))}
                    {location.gaps.map((gap) => (
                      <li
                        key={`gap-${gap.start}-${gap.end}`}
                        className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-xl bg-[#f7d6d4] px-2.5 py-1.5 text-xs font-semibold text-[#8d3d45]"
                      >
                        <span className="tabular-nums">Gap {rangeLabel(gap.start, gap.end)}</span>
                        <span className="tabular-nums">
                          {gap.have} of {gap.need} needed
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {day.ic.length > 0 ? (
              <p className="mt-3 flex flex-wrap items-start gap-x-2 gap-y-1 border-t border-[var(--border)] pt-2 text-xs">
                <span className="rounded-full bg-[#d7e4f8] px-2 py-0.5 font-semibold text-[#2c4a73]">IC</span>
                <span className="min-w-0 flex-1 break-words text-[var(--muted)]">{day.ic.join(", ")}</span>
              </p>
            ) : null}
            {day.locations.every((location) => location.blocks.length === 0) && day.ic.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">No shifts</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
