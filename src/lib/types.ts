/** Core domain types for Dairy Store Scheduler */

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type LocationCode = "linden" | "lehigh" | "unknown";
export type Department = "floor" | "ic";
export type EmploymentStatus = "active" | "inactive";
export type ScheduleStatus = "draft" | "approved" | "confirmed_worked";
export type HistoryStatus = "draft" | "approved_planned" | "confirmed_worked" | "legacy";

export type AvailabilityCellKind =
  | "empty"
  | "off"
  | "window"
  | "after"
  | "until"
  | "open"
  | "unclear"
  | "unrestricted";

export interface TimeWindow {
  startMinutes: number; // minutes from midnight, America/New_York wall time
  endMinutes: number;
}

export interface AvailabilityCell {
  kind: AvailabilityCellKind;
  /** Human-readable note as entered, e.g. "After 3", "12–6" */
  note?: string;
  window?: TimeWindow;
  needsReview?: boolean;
  provisional?: boolean;
  /**
   * Where this cell value came from. Photo extraction stays separate from
   * recurring DNA baseline and later manual edits.
   */
  source?: "photo" | "recurring" | "manual";
}

export interface EmployeeAlias {
  alias: string;
  confirmed: boolean;
}

export interface EmployeeContext {
  schoolStatus?: "high_school" | "college" | "unconfirmed" | "none";
  notes: string[];
  /** Editable freeform circumstances — not inferred limits */
  circumstances: string[];
}

export interface RecurringAvailability {
  day: DayOfWeek;
  kind: AvailabilityCellKind;
  window?: TimeWindow;
  note?: string;
  enabled: boolean;
}

export interface SchedulingLimit {
  id: string;
  label: string;
  maxHoursPerWeek?: number;
  maxDaysPerWeek?: number;
  minDaysPerWeek?: number;
  earliestStartMinutes?: number;
  latestEndMinutes?: number;
  effectiveFrom?: string; // YYYY-MM-DD
  effectiveTo?: string;
  confirmed: boolean;
}

export interface Qualification {
  id: string;
  code: string; // e.g. "open", "close"
  label: string;
  confirmed: boolean;
}

export interface WorkloadObservation {
  approxWorkdaysPerWeek?: number;
  approxHoursPerWeek?: number;
  hoursRange?: string;
  mainPattern?: string;
  sampleWeeks: number;
  uncertaintyNotes: string[];
}

export interface ShiftTypeObservation {
  startMinutes: number;
  endMinutes: number;
  location?: LocationCode;
  dayHints: DayOfWeek[];
  weeksObserved?: number;
  notes?: string;
  /** When true, do not auto-propose this pattern (manager correction) */
  autoScheduleDisabled?: boolean;
}

export interface WeekdayObservation {
  day: DayOfWeek;
  weeksObserved: number;
  typicalWindows: TimeWindow[];
  notes?: string;
}

export interface EmployeeDna {
  source: string;
  yearNeedsConfirmation: boolean;
  workload?: WorkloadObservation;
  commonShiftTypes: ShiftTypeObservation[];
  weekdayObservations: WeekdayObservation[];
  lehighEvidenceNotes: string[];
  limitedEvidence: boolean;
  enabled: boolean;
  managerOverrides?: string[];
}

export interface EmployeePreference {
  preferredWorkdaysPerWeekMin?: number;
  preferredWorkdaysPerWeekMax?: number;
  preferredShiftWindows?: TimeWindow[];
  notes?: string;
  confirmed: boolean;
}

export interface Employee {
  id: string;
  displayName: string;
  printedLabel: string;
  /** Google account email for staff who signed in themselves. */
  email?: string;
  firstName?: string;
  lastName?: string;
  firstNameConfirmed: boolean;
  lastNameConfirmed: boolean;
  aliases: EmployeeAlias[];
  color: string;
  initials: string;
  status: EmploymentStatus;
  employmentEndDate?: string; // YYYY-MM-DD
  availabilityChangeDate?: string;
  /** When false, generator/repair/gap-fill never auto-assign this person. Manual edits still allowed. */
  autoScheduleEnabled?: boolean;
  context: EmployeeContext;
  recurringAvailability: RecurringAvailability[];
  limits: SchedulingLimit[];
  qualifications: Qualification[];
  preferences: EmployeePreference[];
  dna: EmployeeDna;
  /** True when this person shares an unresolved historical label with another */
  sharedHistoricalLabel?: string;
}

export interface StaffingIntervalTarget {
  id: string;
  day: DayOfWeek | "any";
  location: LocationCode;
  department: Department;
  startMinutes: number;
  endMinutes: number;
  minimum: number;
  desired: number;
  enabled: boolean;
  confirmed: boolean;
  label?: string;
}

export interface RoleTarget {
  id: string;
  day: DayOfWeek | "any";
  location: LocationCode;
  role: "open" | "close";
  required: boolean;
  confirmed: boolean;
  eligibleEmployeeIds: string[];
}

export interface AppSettings {
  locationConventionConfirmed: boolean;
  /** When true, shifts without L are treated as Linden */
  unmarkedMeansLinden: boolean | null;
  timezone: "America/New_York";
  staffingTargetsNeedConfirmation: boolean;
  openingClosingNeedConfirmation: boolean;
  /** ISO timestamp when Mike approved the one-time baseline (staffing + location convention) */
  baselineApprovedAt?: string | null;
  managerPinHash?: string;
  ocrConfigured: boolean;
}

export interface Shift {
  id: string;
  employeeId: string | null; // null when unresolved (e.g. Lexy/Brooke)
  unresolvedLabel?: string;
  date: string; // YYYY-MM-DD
  startMinutes: number | null;
  endMinutes: number | null;
  location: LocationCode;
  department: Department;
  locked: boolean;
  notes?: string;
  provisionalAvailability?: boolean;
  source: "generated" | "manual" | "history" | "locked_preserved";
  missingTiming?: boolean;
}

export interface WeekAvailability {
  employeeId: string;
  cells: Record<string, AvailabilityCell>; // key = YYYY-MM-DD
}

export interface CoverageIntervalResult {
  date: string;
  location: LocationCode;
  department: Department;
  startMinutes: number;
  endMinutes: number;
  count: number;
  minimum: number;
  desired: number;
  status:
    | "below_minimum"
    | "minimum_met"
    | "desired_met"
    | "excess"
    | "no_target"
    | "staffing_target_missing"
    | "unstaffed_open";
  /** Exact reason coverage could not be filled without inventing availability */
  unfilledReason?: string;
  /** Employees covering this interval at the weakest probe (floor only) */
  assignedEmployeeIds?: string[];
  /** True when this row comes from opening-hours split (not only a configured target) */
  fromOpeningHours?: boolean;
}

export interface ScheduleIssue {
  id: string;
  severity: "hard" | "shortage" | "soft" | "info";
  code: string;
  message: string;
  date?: string;
  startMinutes?: number;
  endMinutes?: number;
  location?: LocationCode;
  department?: Department;
  employeeId?: string;
  shiftId?: string;
}

export interface EmployeeTotals {
  employeeId: string;
  hours: number;
  workdays: number;
  shifts: number;
}

export interface ScheduleExplanation {
  bullets: string[];
  allAvailabilityHonored: boolean;
  provisionalCount: number;
  unresolvedAvailabilityCount: number;
  unresolvedLocationCount: number;
  /** True when at least one non-empty availability cell was entered this week */
  availabilityCalendarEntered: boolean;
  /** Draft built without confirmed calendar / availability checks */
  provisionalDraft: boolean;
}

export interface WeekSchedule {
  id: string;
  weekStart: string; // Monday YYYY-MM-DD
  weekEnd: string; // Sunday YYYY-MM-DD
  status: ScheduleStatus;
  shifts: Shift[];
  availability: WeekAvailability[];
  availabilityReviewed: boolean;
  issues: ScheduleIssue[];
  coverage: CoverageIntervalResult[];
  totals: EmployeeTotals[];
  explanation: ScheduleExplanation;
  approvedAt?: string;
  approvedSnapshot?: Shift[];
  acknowledgmentRequired?: boolean;
  acknowledgmentAccepted?: boolean;
  buildMeta?: {
    durationMs: number;
    partial: boolean;
    timedOut: boolean;
    mode?: "build" | "preview_patterns";
  };
  /**
   * Dismissed OCR extraction marks for this week (`normalizedRaw|date`).
   * Audit evidence stays in OCR debug artifacts; this only suppresses re-review
   * and blocks those marks from scheduling inputs. Not a separate table.
   */
  dismissedExtractionKeys?: string[];
  /** Private upload key for the calendar photo used in this week session. */
  photoStorageKey?: string | null;
}

/** Explicitly saved creation session — not auto-resumed on open/refresh. */
export interface SavedScheduleSession {
  id: string;
  weekStart: string;
  weekEnd: string;
  savedAt: string;
  status: ScheduleStatus;
  shiftCount: number;
  hasPhoto: boolean;
  availabilityReviewed: boolean;
  /** Full week snapshot at save time */
  week: WeekSchedule;
}

export interface HistoricalShiftRecord {
  id: string;
  employeeId: string | null;
  unresolvedLabel?: string;
  date: string;
  startMinutes: number | null;
  endMinutes: number | null;
  location: LocationCode;
  department: Department;
  uncertain: boolean;
  notes?: string;
}

export interface HistoricalWeek {
  id: string;
  weekStart: string;
  weekEnd: string;
  yearConfirmed: boolean;
  status: HistoryStatus;
  authoritative: boolean;
  duplicateGroup?: string;
  sourceLabel: string;
  shifts: HistoricalShiftRecord[];
  notes: string[];
}

export interface NameMatchResult {
  status: "exact" | "ambiguous" | "unknown";
  employeeIds: string[];
  query: string;
  message?: string;
  /** Dialog lead, e.g. "Possible match: Jordan R." */
  reviewHeadline?: string;
}

export interface ReplacementCandidate {
  employeeId: string;
  displayName: string;
  status: "confirmed_available" | "needs_availability_check";
  reason: string;
}

export interface AppData {
  version: number;
  seededAt: string;
  employees: Employee[];
  settings: AppSettings;
  staffingTargets: StaffingIntervalTarget[];
  roleTargets: RoleTarget[];
  /** Active working week(s) for the current creation session. */
  weeks: WeekSchedule[];
  /**
   * Explicitly saved drafts / completed schedules.
   * Opened only via Previous schedules — never auto-resumed on refresh.
   */
  savedSessions?: SavedScheduleSession[];
  history: HistoricalWeek[];
  sharedRowPatterns: SharedRowPattern[];
}

export interface SharedRowPattern {
  id: string;
  label: string;
  relatedEmployeeIds: string[];
  observations: string[];
  sampleWeeks: number;
  hoursPerWeekShared: number;
  shiftsPerWeekShared: number;
  unresolved: true;
}
