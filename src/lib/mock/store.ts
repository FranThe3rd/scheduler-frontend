import { createEmptyAppData, ensureWeek } from "../fixtures/appData";
import {
  confirmLehighTargetsOnly,
  confirmLindenTargetsOnly,
  ensureStaffingTargets,
  staffingConfirmationStatus,
  lehighProposalSources,
} from "../staffingTargets";
import type { AppData, AvailabilityCell, Employee, WeekSchedule } from "../types";
import { revalidateWeek } from "../validation";
import { weekDates } from "../time";
import { DEMO_WEEK_START } from "./oct2025Schedule";

let appData: AppData | null = null;
let mockCacheVersion = 0;
/** Bump when demo seed changes so dev hot reload picks up new week/order. */
const MOCK_DATA_VERSION = 7;

export function getMockAppData(): AppData {
  if (!appData || mockCacheVersion !== MOCK_DATA_VERSION) {
    appData = null;
    mockCacheVersion = MOCK_DATA_VERSION;
  }
  if (!appData) {
    appData = createEmptyAppData({ seedRoster: false });
    appData.staffingTargets = ensureStaffingTargets(appData.staffingTargets);
    appData.staffingTargets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(appData.staffingTargets)
    );
    appData.settings.baselineApprovedAt = new Date().toISOString();
    appData.settings.staffingTargetsNeedConfirmation = false;
    appData.settings.ocrConfigured = false;
    appData.settings.locationConventionConfirmed = true;
    appData.settings.unmarkedMeansLinden = true;
  }
  return appData;
}

/** Drop all in-memory data (used on sign-out so the next account starts clean). */
export function resetMockStore(): void {
  appData = null;
}

/** Replace the visible roster and keep existing weeks' availability rows in sync. */
export function setMockRoster(
  employees: Employee[],
  options: { pruneUnknownEmployees?: boolean } = {}
): void {
  const data = getMockAppData();
  if (options.pruneUnknownEmployees) {
    data.employees = employees;
  } else {
    const incoming = new Map(employees.map((employee) => [employee.id, employee]));
    const next = data.employees.map((employee) => incoming.get(employee.id) ?? employee);
    for (const employee of employees) {
      if (!next.some((item) => item.id === employee.id)) next.push(employee);
    }
    data.employees = next;
  }
  const ids = new Set(data.employees.map((e) => e.id));
  for (const week of data.weeks) {
    if (options.pruneUnknownEmployees) {
      week.shifts = week.shifts.filter((s) => !s.employeeId || ids.has(s.employeeId));
      week.availability = week.availability.filter((a) => ids.has(a.employeeId));
    }
    for (const employee of employees) {
      if (employee.status !== "active") continue;
      if (week.availability.some((a) => a.employeeId === employee.id)) continue;
      week.availability.push({
        employeeId: employee.id,
        cells: Object.fromEntries(weekDates(week.weekStart).map((d) => [d, { kind: "empty" as const }])),
      });
    }
    syncWeek(data, week);
  }
}

export function syncWeek(data: AppData, week: WeekSchedule): void {
  const v = revalidateWeek({
    shifts: week.shifts,
    availability: week.availability,
    employees: data.employees,
    targets: data.staffingTargets,
    weekStart: week.weekStart,
  });
  week.shifts = v.shifts;
  week.issues = v.issues;
  week.coverage = v.coverage;
  week.totals = v.totals;
  week.explanation = { ...week.explanation, ...v.explanation };
}

export function weekFor(data: AppData, weekStart: string): WeekSchedule {
  return ensureWeek(data, weekStart);
}

export { DEMO_WEEK_START, staffingConfirmationStatus, lehighProposalSources };

/** Manually entered availability for one employee, keyed by date. */
export type ManualAvailability = Record<string, AvailabilityCell>;

export function extractManualAvailability(employeeId: string): ManualAvailability {
  const out: ManualAvailability = {};
  for (const week of getMockAppData().weeks) {
    const row = week.availability.find((a) => a.employeeId === employeeId);
    if (!row) continue;
    for (const [date, cell] of Object.entries(row.cells)) {
      if (cell.source === "manual" && cell.kind !== "empty") out[date] = cell;
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** Apply saved availability to the weeks it belongs to (creating those weeks if needed). */
export function applyManualAvailability(employeeId: string, entries: ManualAvailability): void {
  const data = getMockAppData();
  const touched = new Set<WeekSchedule>();
  for (const [date, cell] of Object.entries(entries)) {
    const week = weekFor(data, date);
    let row = week.availability.find((a) => a.employeeId === employeeId);
    if (!row) {
      row = {
        employeeId,
        cells: Object.fromEntries(weekDates(week.weekStart).map((d) => [d, { kind: "empty" as const }])),
      };
      week.availability.push(row);
    }
    row.cells[date] = cell;
    touched.add(week);
  }
  for (const week of touched) syncWeek(data, week);
}
