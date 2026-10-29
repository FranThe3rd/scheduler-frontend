import { format, parseISO } from "date-fns";
import type { Shift } from "./types";
import { weekDates } from "./time";

export const CLIPBOARD_STORAGE_KEY = "dairy-scheduler-clipboard-v1";

export type ShiftTemplate = {
  employeeId: string | null;
  unresolvedLabel?: string;
  startMinutes: number | null;
  endMinutes: number | null;
  location: Shift["location"];
  department: Shift["department"];
  notes?: string;
};

export type WeekClipboard = {
  kind: "week";
  sourceWeekStart: string;
  label: string;
  items: Array<ShiftTemplate & { dayIndex: number }>;
};

export type ScheduleClipboard = WeekClipboard;

export function shiftToTemplate(shift: Shift, weekStart: string): ShiftTemplate & { dayIndex: number } {
  const dates = weekDates(weekStart);
  const dayIndex = dates.indexOf(shift.date);
  return {
    dayIndex: dayIndex >= 0 ? dayIndex : 0,
    employeeId: shift.employeeId,
    unresolvedLabel: shift.unresolvedLabel,
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
    location: shift.location,
    department: shift.department,
    notes: shift.notes,
  };
}

export function weekClipboardFromShifts(weekStart: string, shifts: Shift[]): WeekClipboard {
  const label = format(parseISO(weekStart), "MMM d") + " week";
  return {
    kind: "week",
    sourceWeekStart: weekStart,
    label,
    items: shifts.map((s) => shiftToTemplate(s, weekStart)),
  };
}

export function readClipboard(): ScheduleClipboard | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CLIPBOARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScheduleClipboard;
    return parsed.kind === "week" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeClipboard(clip: ScheduleClipboard | null): void {
  if (typeof window === "undefined") return;
  if (!clip) sessionStorage.removeItem(CLIPBOARD_STORAGE_KEY);
  else sessionStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(clip));
}

export function clipboardSummary(clip: WeekClipboard | null): string | null {
  if (!clip) return null;
  const n = clip.items.length;
  return `${clip.label} · ${n} shift${n === 1 ? "" : "s"}`;
}
