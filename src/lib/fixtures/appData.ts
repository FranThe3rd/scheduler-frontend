/**
 * In-memory app fixtures for tests and local domain logic.
 * Persistence and HTTP APIs are not included — implement those in your backend.
 */
import { format, addDays } from "date-fns";
import {
  buildSeedEmployees,
  buildDefaultSettings,
  buildDefaultStaffingTargets,
  buildDefaultRoleTargets,
  SHARED_ROW_PATTERNS,
} from "../seed/employees";
import { emptyWeekAvailability } from "../validation";
import { mondayOf } from "../time";
import type { AppData, HistoricalWeek, WeekSchedule } from "../types";

function buildHistoryPlaceholders(): HistoricalWeek[] {
  return [
    {
      id: "hist_aug24_sep20_summary",
      weekStart: "2025-08-24",
      weekEnd: "2025-09-20",
      yearConfirmed: false,
      status: "approved_planned",
      authoritative: false,
      sourceLabel:
        "Aggregate DNA summaries for Aug 24–30, Aug 31–Sep 6, Sep 7–13, Sep 14–20 (year needs confirmation). Individual shifts not fabricated.",
      shifts: [],
      notes: [
        "Stored as editable pattern summaries only — not fabricated shift rows.",
        "July 21, 2025 legacy roster excluded from current-pattern averages.",
        "September 21–27 appears in multiple photos with unresolved differences — count as one week once resolved.",
        "Do not auto-activate legacy names such as A. Miller, N. Czaika, or handwritten T. Stone.",
      ],
    },
    {
      id: "hist_sep21_27_dup",
      weekStart: "2025-09-21",
      weekEnd: "2025-09-27",
      yearConfirmed: false,
      status: "draft",
      authoritative: false,
      duplicateGroup: "sep21_27",
      sourceLabel: "Two photographs with unresolved differences — not counted twice in DNA.",
      shifts: [],
      notes: [
        "Differences remain unresolved. Do not assume which version is final.",
        "Emily appears as a handwritten addition in one version only.",
      ],
    },
    {
      id: "hist_legacy_2025_07_21",
      weekStart: "2025-07-21",
      weekEnd: "2025-07-27",
      yearConfirmed: true,
      status: "legacy",
      authoritative: false,
      sourceLabel: "July 21, 2025 legacy schedule — older roster; excluded from current DNA averages.",
      shifts: [],
      notes: ["Legacy history only."],
    },
  ];
}

/** `seedRoster: false` starts with no employees (the live app; staff join as they sign in). */
export function createEmptyAppData(options: { seedRoster?: boolean } = {}): AppData {
  const employees = options.seedRoster === false ? [] : buildSeedEmployees();
  return {
    version: 1,
    seededAt: new Date().toISOString(),
    employees,
    settings: buildDefaultSettings(),
    staffingTargets: buildDefaultStaffingTargets(),
    roleTargets: buildDefaultRoleTargets(),
    weeks: [],
    savedSessions: [],
    history: buildHistoryPlaceholders(),
    sharedRowPatterns: SHARED_ROW_PATTERNS,
  };
}

export function ensureWeek(data: AppData, weekStartInput?: string): WeekSchedule {
  const start = format(mondayOf(weekStartInput ?? new Date()), "yyyy-MM-dd");
  const existing = data.weeks.find((w) => w.weekStart === start);
  if (existing) return existing;

  const week: WeekSchedule = {
    id: `week_${start}`,
    weekStart: start,
    weekEnd: format(addDays(mondayOf(start), 6), "yyyy-MM-dd"),
    status: "draft",
    shifts: [],
    availability: emptyWeekAvailability(data.employees, start),
    availabilityReviewed: false,
    issues: [],
    coverage: [],
    totals: [],
    explanation: {
      bullets: [],
      allAvailabilityHonored: false,
      provisionalCount: 0,
      unresolvedAvailabilityCount: 0,
      unresolvedLocationCount: 0,
      availabilityCalendarEntered: false,
      provisionalDraft: true,
    },
  };
  data.weeks.push(week);
  return week;
}
