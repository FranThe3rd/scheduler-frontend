import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { DayOfWeek, TimeWindow } from "./types";

export const DAY_ORDER: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function mondayOf(date: Date | string): Date {
  const d = typeof date === "string" ? parseISO(date) : date;
  return startOfWeek(d, { weekStartsOn: 1 });
}

export function weekDates(weekStart: string): string[] {
  const start = parseISO(weekStart);
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

export function dayOfWeekFromDate(date: string): DayOfWeek {
  const d = parseISO(date);
  const js = d.getUTCDay(); // dates stored as calendar dates; use local parse
  // parseISO of yyyy-MM-dd is UTC midnight; getUTCDay is correct for calendar date
  const map: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[js]!;
}

export function formatWeekRange(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = addDays(start, 6);
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

/** Calendar date YYYY-MM-DD in America/New_York */
export function todayInNewYork(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function thisWeekMondayNy(): string {
  return format(mondayOf(todayInNewYork()), "yyyy-MM-dd");
}

/** Inclusive day count between two YYYY-MM-DD dates */
export function inclusiveDaySpan(start: string, end: string): number {
  const a = parseISO(start);
  const b = parseISO(end);
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

export function isValidSevenDayWeek(start: string, end: string): boolean {
  if (end < start) return false;
  return inclusiveDaySpan(start, end) === 7;
}

export function minutesToLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return m === 0 ? `${h} ${suffix}` : `${h}:${m.toString().padStart(2, "0")} ${suffix}`;
}

export function formatShiftTimes(start: number | null, end: number | null): string {
  if (start == null || end == null) return "Time needed";
  return `${minutesToLabel(start)}–${minutesToLabel(end)}`;
}

/** Parse notes like "After 3", "Until 4", "12-6", "12–6", "9-1" */
export function parseAvailabilityNote(raw: string): {
  kind: "off" | "after" | "until" | "window" | "open" | "unclear";
  window?: TimeWindow;
  note: string;
} {
  const note = raw.trim();
  const lower = note.toLowerCase();
  if (!note || lower === "—" || lower === "-") {
    return { kind: "off", note: "Off" };
  }
  if (lower === "off" || lower === "x") {
    return { kind: "off", note: "Off" };
  }
  if (lower === "open") {
    return { kind: "open", note: "Open" };
  }

  const after = lower.match(/^after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (after) {
    const mins = clockToMinutes(Number(after[1]), Number(after[2] || 0), after[3], "pm-default-afternoon");
    return { kind: "after", window: { startMinutes: mins, endMinutes: 22 * 60 }, note };
  }

  const until = lower.match(/^until\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (until) {
    const mins = clockToMinutes(Number(until[1]), Number(until[2] || 0), until[3], "pm-default-afternoon");
    return { kind: "until", window: { startMinutes: 9 * 60, endMinutes: mins }, note };
  }

  const range = note.match(/^(\d{1,2})(?::(\d{2}))?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (range) {
    const start = clockToMinutes(Number(range[1]), Number(range[2] || 0), undefined, "infer-range-start");
    let end = clockToMinutes(Number(range[3]), Number(range[4] || 0), range[5], "infer-range-end");
    // Heuristic: if end < start, end is PM and start is AM (e.g. 9-1)
    if (end <= start) end += 12 * 60;
    if (start < 7 * 60 && end - start > 8 * 60) {
      // likely evening written without am/pm e.g. 6-10
    }
    // Common ice cream store: 6-10 is evening
    if (Number(range[1]) <= 7 && Number(range[3]) <= 11 && !range[5] && start < 12 * 60) {
      const s = Number(range[1]);
      const e = Number(range[3]);
      if (s >= 5 && e >= 9 && e <= 11) {
        return {
          kind: "window",
          window: { startMinutes: (s + 12) * 60, endMinutes: (e + 12) * 60 },
          note,
        };
      }
    }
    return { kind: "window", window: { startMinutes: start, endMinutes: end }, note };
  }

  return { kind: "unclear", note };
}

function clockToMinutes(
  hour: number,
  minute: number,
  ampm: string | undefined,
  mode: string
): number {
  let h = hour;
  if (ampm) {
    const ap = ampm.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return h * 60 + minute;
  }
  if (mode === "pm-default-afternoon" && h < 8) h += 12;
  if (mode === "infer-range-start" && h >= 1 && h <= 7) {
    // leave as-is; caller may adjust
  }
  return h * 60 + minute;
}

export function shiftDurationHours(start: number | null, end: number | null): number {
  if (start == null || end == null || end <= start) return 0;
  return (end - start) / 60;
}

/** Half-open interval overlap: [a,b) overlaps [c,d) */
export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Adjacent boundary (end === start) is NOT an overlap */
export function shiftsOverlap(
  a: { startMinutes: number | null; endMinutes: number | null },
  b: { startMinutes: number | null; endMinutes: number | null }
): boolean {
  if (
    a.startMinutes == null ||
    a.endMinutes == null ||
    b.startMinutes == null ||
    b.endMinutes == null
  ) {
    return false;
  }
  return intervalsOverlap(a.startMinutes, a.endMinutes, b.startMinutes, b.endMinutes);
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
