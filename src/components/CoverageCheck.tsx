"use client";

import { format, parseISO } from "date-fns";
import type { CoverageIntervalResult, Employee, StaffingIntervalTarget, WeekSchedule } from "@/lib/types";
import { formatShiftCellCompact } from "@/lib/shiftCellText";
import { weekDates } from "@/lib/time";
import { revalidateWeek } from "@/lib/validation";

type Tone = "ok" | "thin" | "short" | "over";

type Band = {
  start: number;
  end: number;
  count: number;
  minimum: number;
  desired: number;
  tone: Tone;
};

function toneFor(row: CoverageIntervalResult): Tone | null {
  if (row.status === "below_minimum") return "short";
  if (row.status === "excess") return "over";
  if (row.status === "minimum_met" && row.desired > row.minimum && row.count < row.desired) return "thin";
  if (row.status === "minimum_met" || row.status === "desired_met") return "ok";
  return null;
}

function bandLabel(start: number, end: number): string {
  if (start % 60 === 0 && end % 60 === 0) return formatShiftCellCompact(start, end);
  const clock = (minutes: number) => {
    const h24 = Math.floor(minutes / 60);
    const m = minutes % 60;
    const h = h24 % 12 === 0 ? 12 : h24 % 12;
    return m === 0 ? String(h) : `${h}:${String(m).padStart(2, "0")}`;
  };
  return `${clock(start)}–${clock(end)}`;
}

function mergeBands(rows: CoverageIntervalResult[]): Band[] {
  const sorted = rows
    .map((row) => ({ row, tone: toneFor(row) }))
    .filter((item): item is { row: CoverageIntervalResult; tone: Tone } => item.tone != null)
    .sort((a, b) => a.row.startMinutes - b.row.startMinutes);

  const bands: Band[] = [];
  for (const { row, tone } of sorted) {
    const last = bands[bands.length - 1];
    if (
      last &&
      last.tone === tone &&
      last.end === row.startMinutes &&
      last.minimum === row.minimum &&
      last.desired === row.desired
    ) {
      last.end = row.endMinutes;
      last.count = tone === "over" ? Math.max(last.count, row.count) : Math.min(last.count, row.count);
      continue;
    }
    bands.push({
      start: row.startMinutes,
      end: row.endMinutes,
      count: row.count,
      minimum: row.minimum,
      desired: row.desired,
      tone,
    });
  }
  return bands;
}

function needFor(band: Band): number {
  if (band.tone === "short") return Math.max(band.minimum, 1);
  return Math.max(band.desired, band.minimum, 1);
}

function barColor(tone: Tone): string {
  if (tone === "ok") return "#7d9a86";
  if (tone === "thin") return "#e0a04a";
  if (tone === "over") return "#8d6a4a";
  return "#d4896a";
}

function countColor(tone: Tone): string {
  if (tone === "ok") return "var(--muted)";
  if (tone === "thin" || tone === "over") return "#6d5310";
  return "#8d3d45";
}

function locName(loc: string): string {
  return loc === "lehigh" ? "Lehi" : "Main";
}

export function CoverageCheck({
  week,
  employees,
  targets,
}: {
  week: WeekSchedule;
  employees: Employee[];
  targets: StaffingIntervalTarget[];
}) {
  const dates = weekDates(week.weekStart);
  const saved = week.shifts.some(
    (shift) => shift.department === "floor" && shift.startMinutes != null && shift.endMinutes != null
  );
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
    const locations = (["linden", "lehigh"] as const).map((location) => ({
      location,
      name: locName(location),
      bands: mergeBands(coverage.filter((row) => row.date === date && row.location === location)),
    }));
    const clear = locations.every((location) => location.bands.length > 0 && location.bands.every((band) => band.tone === "ok"));
    return { date, locations, clear };
  });
  const clearDays = days.filter((day) => day.clear).length;
  const summary = !saved ? "Nothing saved yet" : `${clearDays} of ${dates.length} clear`;

  return (
    <section className="card mt-4 p-4 shadow-none" aria-label="Coverage">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">Coverage</h2>
        <p
          className={`text-sm font-semibold ${
            !saved ? "text-[var(--muted)]" : clearDays === dates.length ? "text-[#2f6b4f]" : "text-[#8d3d45]"
          }`}
        >
          {summary}
        </p>
      </div>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2">
        {days.map((day) => (
          <li key={day.date}>
            <p className="text-sm font-semibold">{format(parseISO(day.date), "EEEE")}</p>
            {day.locations.map((location) => (
              <div key={location.location} className="mt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{location.name}</p>
                {location.bands.length === 0 ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">No target</p>
                ) : (
                  <ul className="mt-1 space-y-1.5">
                    {location.bands.map((band) => {
                      const need = needFor(band);
                      const width = Math.min(100, Math.round((band.count / need) * 100));
                      return (
                        <li
                          key={`${band.start}-${band.end}`}
                          className="grid grid-cols-[4rem_1fr_auto] items-center gap-2"
                        >
                          <span className="text-sm font-medium">{bandLabel(band.start, band.end)}</span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-[#efe6d8]">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${width}%`, background: barColor(band.tone) }}
                            />
                          </span>
                          <span className="text-xs font-semibold tabular-nums" style={{ color: countColor(band.tone) }}>
                            {band.count}/{need}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
