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
  if (row.status === "below_minimum" || row.status === "unstaffed_open") return "short";
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
  if (tone === "ok") return "#2f6b4f";
  if (tone === "thin") return "#e0941a";
  if (tone === "over") return "#8d6a4a";
  return "#e07a3a";
}

function countColor(tone: Tone): string {
  if (tone === "ok") return "#2f6b4f";
  if (tone === "thin" || tone === "over") return "#8a5a12";
  return "#c0562a";
}

function staffLabel(band: Band): string {
  if (band.tone === "ok" && band.desired > band.minimum) return `${band.minimum}–${band.desired} staff`;
  if (band.tone === "ok") return `${band.count} staff`;
  if (band.count === 0) return `needs ${Math.max(band.minimum, band.desired, 1)}`;
  return `${band.count} staff`;
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
  const hasBands = days.some((day) => day.locations.some((location) => location.bands.length > 0));

  return (
    <section className="card mt-4 p-5 shadow-none" aria-label="Coverage check">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl">Coverage check</h2>
        <p className={`text-base font-semibold ${clearDays === dates.length && hasBands ? "text-[#2f6b4f]" : "text-[#c0562a]"}`}>
          {hasBands ? `${clearDays} of ${dates.length} clear` : "No targets yet"}
        </p>
      </div>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {days.map((day) => (
          <li key={day.date} className="rounded-2xl bg-[var(--surface)] px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-base font-semibold">
                {format(parseISO(day.date), "EEEE")}
                <span className="ml-2 text-sm font-normal text-[var(--muted)]">{format(parseISO(day.date), "MMM d")}</span>
              </p>
              <p className={`text-sm font-semibold ${day.clear ? "text-[#2f6b4f]" : "text-[#c0562a]"}`}>
                {day.clear ? "Clear" : "Short"}
              </p>
            </div>
            {day.locations.every((location) => location.bands.length === 0) ? (
              <p className="mt-3 text-sm text-[var(--muted)]">No target</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {day.locations.flatMap((location) =>
                  location.bands.map((band) => {
                    const need = needFor(band);
                    const width = Math.min(100, Math.round((band.count / need) * 100));
                    const label = location.location === "lehigh" ? `Lehigh ${bandLabel(band.start, band.end)}` : bandLabel(band.start, band.end);
                    return (
                      <li key={`${location.location}-${band.start}-${band.end}`} className="grid grid-cols-[6.75rem_1fr_6.25rem] items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums">{label}</span>
                        <span className="h-3 overflow-hidden rounded-full bg-[#e6e0d6]">
                          <span className="block h-full rounded-full" style={{ width: `${width}%`, background: barColor(band.tone) }} />
                        </span>
                        <span className="text-right text-sm font-semibold tabular-nums" style={{ color: countColor(band.tone) }}>
                          {staffLabel(band)}
                        </span>
                      </li>
                    );
                  }),
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
