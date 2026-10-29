import type { AvailabilityCell, DayOfWeek, Employee, WeekAvailability, WeekSchedule } from "./types";
import { dayOfWeekFromDate, parseAvailabilityNote, weekDates } from "./time";
import { resolveEmployeeName } from "./names";

/** Fill week cells from each employee's confirmed recurring availability (baseline).
 * Preserves photo sign-offs and manual edits — never clears them to enable Build.
 */
export function applyRecurringBaseline(
  week: WeekSchedule,
  employees: Employee[]
): void {
  const dates = weekDates(week.weekStart);
  for (const emp of employees.filter((e) => e.status === "active")) {
    let row = week.availability.find((a) => a.employeeId === emp.id);
    if (!row) {
      row = { employeeId: emp.id, cells: {} };
      week.availability.push(row);
    }
    for (const date of dates) {
      const existing = row.cells[date];
      // Keep photo sign-offs / notes and manager manual edits
      if (existing?.source === "photo" || existing?.source === "manual") {
        continue;
      }

      const day = dayOfWeekFromDate(date);
      const recurring = emp.recurringAvailability?.find((r) => r.enabled && r.day === day);
      if (recurring?.window) {
        row.cells[date] = {
          kind: "window",
          note: recurring.note ?? "Recurring",
          window: recurring.window,
          source: "recurring",
        };
      } else if (recurring?.kind === "off") {
        row.cells[date] = { kind: "off", note: "Off", source: "recurring" };
      } else if (recurring?.kind === "open" || recurring?.kind === "unrestricted") {
        row.cells[date] = {
          kind: recurring.kind === "unrestricted" ? "unrestricted" : "open",
          note: recurring.note ?? "Open",
          source: "recurring",
        };
      } else {
        // No confirmed recurring restriction — empty is NOT available-all-day
        row.cells[date] = { kind: "empty", source: "recurring" };
      }
    }
  }
}

export function resolveWeekDate(
  weekStart: string,
  date: string | undefined,
  weekday: string | undefined
): string | undefined {
  const dates = weekDates(weekStart);
  if (date && dates.includes(date)) return date;
  if (!weekday) return undefined;
  const want = weekday.toLowerCase().trim() as DayOfWeek;
  return dates.find((d) => dayOfWeekFromDate(d) === want);
}

/**
 * Convert an extracted calendar note into an availability cell.
 * Plain name on a sign-off calendar = whole-day unavailable.
 * Partial notes keep after/until/window restrictions.
 * Ambiguous handwriting is flagged unclear — never guessed.
 */
export function cellFromExtractionEntry(entry: {
  note?: string;
  kindHint?: string;
  crossedOut?: boolean;
}): AvailabilityCell {
  if (entry.crossedOut || entry.kindHint === "unclear") {
    const note = entry.note
      ? entry.crossedOut
        ? `Unclear/crossed out: ${entry.note}`
        : entry.note
      : entry.crossedOut
        ? "Unclear/crossed out"
        : "Unclear";
    return { kind: "unclear", note, needsReview: true, source: "photo" };
  }

  if (entry.kindHint === "off") {
    return { kind: "off", note: "Off", source: "photo" };
  }
  if (entry.kindHint === "empty") {
    return { kind: "empty", source: "photo" };
  }
  if (entry.kindHint === "open") {
    return { kind: "open", note: "Open", source: "photo" };
  }

  const note = entry.note?.trim();
  if (note) {
    const parsed = parseAvailabilityNote(note);
    if (parsed.kind === "off") {
      return { kind: "off", note: "Off", source: "photo" };
    }
    if (parsed.kind === "unclear") {
      return { kind: "unclear", note: parsed.note, needsReview: true, source: "photo" };
    }
    return {
      kind: parsed.kind,
      note: parsed.note,
      window: parsed.window,
      needsReview: false,
      source: "photo",
    };
  }

  if (entry.kindHint === "after" || entry.kindHint === "until" || entry.kindHint === "window") {
    return {
      kind: "unclear",
      note: `Partial restriction (${entry.kindHint}) — confirm time`,
      needsReview: true,
      source: "photo",
    };
  }

  // Default for a visible handwritten name with no time text: whole-day sign-off
  return { kind: "off", note: "Off", source: "photo" };
}

/** Clear photo-sourced cells for this week so a replacement upload does not accumulate. Manual edits stay. */
export function clearPhotoAvailability(week: WeekSchedule): number {
  let cleared = 0;
  for (const row of week.availability) {
    for (const date of Object.keys(row.cells)) {
      if (row.cells[date]?.source === "photo") {
        delete row.cells[date];
        cleared += 1;
      }
    }
  }
  return cleared;
}

export function overlayExtractionOnWeek(
  week: WeekSchedule,
  employees: Employee[],
  entries: Array<{
    rawName?: string;
    employeeId?: string | null;
    date?: string;
    weekday?: string;
    note?: string;
    kindHint?: string;
    crossedOut?: boolean;
  }>,
  options?: { replacePhoto?: boolean }
): { applied: number; skipped: number; cleared: number } {
  const cleared = options?.replacePhoto ? clearPhotoAvailability(week) : 0;
  const dates = weekDates(week.weekStart);
  let applied = 0;
  let skipped = 0;

  for (const entry of entries) {
    const date = resolveWeekDate(week.weekStart, entry.date, entry.weekday);
    if (!date || !dates.includes(date)) {
      skipped += 1;
      continue;
    }

    let employeeId = entry.employeeId ?? undefined;
    if (!employeeId && entry.rawName) {
      const match = resolveEmployeeName(entry.rawName, employees);
      if (match.status === "exact" && match.employeeIds.length === 1) {
        employeeId = match.employeeIds[0];
      }
    }
    if (!employeeId) {
      skipped += 1;
      continue;
    }

    let row: WeekAvailability | undefined = week.availability.find((a) => a.employeeId === employeeId);
    if (!row) {
      row = { employeeId, cells: {} };
      week.availability.push(row);
    }

    row.cells[date] = cellFromExtractionEntry(entry);
    applied += 1;
  }

  return { applied, skipped, cleared };
}
