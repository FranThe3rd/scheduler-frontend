/**
 * Creation-session helpers: week dates ≠ auto-resume of prior work.
 * Saved drafts live in AppData.savedSessions and open only explicitly.
 */
import { addDays, format } from "date-fns";
import type { AppData, SavedScheduleSession, WeekSchedule } from "./types";
import { mondayOf, newId } from "./time";
import { emptyWeekAvailability } from "./validation";
import { applyRecurringBaseline } from "./availabilityApply";
import { ensureRecurringBaselineFromDna } from "./recurringFromDna";

function emptyExplanation(): WeekSchedule["explanation"] {
  return {
    bullets: [],
    allAvailabilityHonored: false,
    provisionalCount: 0,
    unresolvedAvailabilityCount: 0,
    unresolvedLocationCount: 0,
    availabilityCalendarEntered: false,
    provisionalDraft: true,
  };
}

export function buildBlankWeek(data: AppData, weekStartInput: string): WeekSchedule {
  const start = format(mondayOf(weekStartInput), "yyyy-MM-dd");
  return {
    id: `week_${start}_${Date.now().toString(36)}`,
    weekStart: start,
    weekEnd: format(addDays(mondayOf(start), 6), "yyyy-MM-dd"),
    status: "draft",
    shifts: [],
    availability: emptyWeekAvailability(data.employees, start),
    availabilityReviewed: false,
    issues: [],
    coverage: [],
    totals: [],
    explanation: emptyExplanation(),
    dismissedExtractionKeys: [],
    photoStorageKey: null,
  };
}

/** Fresh creation session: recurring DNA windows only — no photo offs, shifts, or review. */
export function buildFreshWorkingWeek(data: AppData, weekStartInput: string): WeekSchedule {
  ensureRecurringBaselineFromDna(data.employees);
  const week = buildBlankWeek(data, weekStartInput);
  applyRecurringBaseline(week, data.employees);
  week.availabilityReviewed = false;
  week.shifts = [];
  week.issues = [];
  week.coverage = [];
  week.totals = [];
  week.explanation = emptyExplanation();
  week.dismissedExtractionKeys = [];
  week.photoStorageKey = null;
  week.approvedAt = undefined;
  week.approvedSnapshot = undefined;
  week.buildMeta = undefined;
  return week;
}

export function weekHasMeaningfulWork(week: WeekSchedule | undefined | null): boolean {
  if (!week) return false;
  if (week.shifts.length > 0) return true;
  if (week.availabilityReviewed) return true;
  if (week.photoStorageKey) return true;
  if ((week.dismissedExtractionKeys ?? []).length > 0) return true;
  if (week.coverage.length > 0) return true;
  for (const row of week.availability) {
    for (const cell of Object.values(row.cells)) {
      if (cell.source === "photo" || cell.source === "manual") return true;
      if (cell.kind === "off" && cell.source !== "recurring") return true;
    }
  }
  return false;
}

export function ensureSavedSessions(data: AppData): SavedScheduleSession[] {
  if (!data.savedSessions) data.savedSessions = [];
  return data.savedSessions;
}

/** One-time: copy existing meaningful weeks into savedSessions so they appear under Previous. */
export function migrateWeeksIntoSavedSessions(data: AppData): boolean {
  const sessions = ensureSavedSessions(data);
  let mutated = false;
  for (const week of data.weeks) {
    if (!weekHasMeaningfulWork(week)) continue;
    if (hasEquivalentSession(sessions, week)) continue;
    sessions.push(snapshotWeekToSession(week));
    mutated = true;
  }
  return mutated;
}

function hasEquivalentSession(sessions: SavedScheduleSession[], week: WeekSchedule): boolean {
  return sessions.some(
    (s) =>
      s.weekStart === week.weekStart &&
      s.shiftCount === week.shifts.length &&
      s.availabilityReviewed === week.availabilityReviewed &&
      (s.week.photoStorageKey ?? null) === (week.photoStorageKey ?? null) &&
      JSON.stringify(s.week.shifts.map((x) => x.id).sort()) ===
        JSON.stringify(week.shifts.map((x) => x.id).sort())
  );
}

/**
 * On app open / refresh: park any working week with real work into Previous schedules
 * and clear it from the active working set so it is not auto-resumed.
 */
export function parkWorkingWeeksAsSaved(data: AppData): boolean {
  let mutated = migrateWeeksIntoSavedSessions(data);
  const next: WeekSchedule[] = [];
  for (const week of data.weeks) {
    if (weekHasMeaningfulWork(week)) {
      mutated = true;
      continue; // parked in savedSessions
    }
    next.push(week);
  }
  if (next.length !== data.weeks.length) {
    data.weeks = next;
    mutated = true;
  }
  return mutated;
}

export function snapshotWeekToSession(week: WeekSchedule): SavedScheduleSession {
  const copy = structuredClone(week) as WeekSchedule;
  return {
    id: newId("session"),
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    savedAt: new Date().toISOString(),
    status: week.status,
    shiftCount: week.shifts.length,
    hasPhoto: Boolean(week.photoStorageKey),
    availabilityReviewed: week.availabilityReviewed,
    week: copy,
  };
}

/**
 * Archive the current working week for this Monday if it has work, then install a fresh week.
 * Does not delete prior saved sessions.
 */
export function startFreshCreationSession(
  data: AppData,
  weekStartInput: string
): { week: WeekSchedule; archived: boolean } {
  const start = format(mondayOf(weekStartInput), "yyyy-MM-dd");
  const sessions = ensureSavedSessions(data);
  const existing = data.weeks.find((w) => w.weekStart === start);
  let archived = false;
  if (existing && weekHasMeaningfulWork(existing)) {
    if (!hasEquivalentSession(sessions, existing)) {
      sessions.unshift(snapshotWeekToSession(existing));
      archived = true;
    }
  }
  const fresh = buildFreshWorkingWeek(data, start);
  data.weeks = data.weeks.filter((w) => w.weekStart !== start);
  data.weeks.push(fresh);
  return { week: fresh, archived };
}

/**
 * Restore an explicit saved session into the working week slot.
 * Archives the current working week first when it has unsaved-looking work.
 */
export function restoreSavedSession(
  data: AppData,
  sessionId: string
): { week: WeekSchedule; photoStorageKey: string | null } | null {
  const sessions = ensureSavedSessions(data);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  const start = session.weekStart;
  const existing = data.weeks.find((w) => w.weekStart === start);
  if (existing && weekHasMeaningfulWork(existing)) {
    // Avoid duplicating the exact session being restored
    const sameAsTarget =
      existing.shifts.length === session.week.shifts.length &&
      (existing.photoStorageKey ?? null) === (session.week.photoStorageKey ?? null) &&
      existing.availabilityReviewed === session.week.availabilityReviewed;
    if (!sameAsTarget) {
      sessions.unshift(snapshotWeekToSession(existing));
    }
  }

  const restored = structuredClone(session.week) as WeekSchedule;
  // Keep session id stable on the working copy for clarity
  restored.id = session.week.id || `week_${start}`;
  data.weeks = data.weeks.filter((w) => w.weekStart !== start);
  data.weeks.push(restored);
  return {
    week: restored,
    photoStorageKey: restored.photoStorageKey ?? null,
  };
}

export type PreviousScheduleSummary = {
  id: string;
  weekStart: string;
  weekEnd: string;
  savedAt: string;
  status: string;
  shiftCount: number;
  hasPhoto: boolean;
  availabilityReviewed: boolean;
};

export function listPreviousSchedules(data: AppData): PreviousScheduleSummary[] {
  migrateWeeksIntoSavedSessions(data);
  return ensureSavedSessions(data)
    .slice()
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .map((s) => ({
      id: s.id,
      weekStart: s.weekStart,
      weekEnd: s.weekEnd,
      savedAt: s.savedAt,
      status: s.status,
      shiftCount: s.shiftCount,
      hasPhoto: s.hasPhoto,
      availabilityReviewed: s.availabilityReviewed,
    }));
}

/** After generate/edit — keep a Previous-schedules snapshot without waiting for refresh. */
export function rememberWorkingWeekInPrevious(data: AppData, weekStart: string): void {
  const week = data.weeks.find((w) => w.weekStart === weekStart);
  if (!week || !weekHasMeaningfulWork(week)) return;
  const sessions = ensureSavedSessions(data);
  if (hasEquivalentSession(sessions, week)) return;
  sessions.unshift(snapshotWeekToSession(week));
}

/** Persist photo key on the working week when OCR upload succeeds. */
export function setWorkingWeekPhotoKey(
  data: AppData,
  weekStart: string,
  photoStorageKey: string | null
): void {
  const week = data.weeks.find((w) => w.weekStart === weekStart);
  if (week) week.photoStorageKey = photoStorageKey;
}
