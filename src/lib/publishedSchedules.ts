import { readJson, subscribeKey, writeJson } from "./mock/localDb";
import type { AssignedShift } from "./scheduleRequests";
import type { Employee, Shift } from "./types";

/** Published shifts per week that staff see on their own schedule, saved in this browser. */
const KEY = "published-schedules";

export type PublishedAssignment = {
  employeeId: string;
  employeeName: string;
  shifts: AssignedShift[];
};

export type PublishedSchedule = {
  weekStart: string;
  assignments: PublishedAssignment[];
  updatedAt?: string;
};

type StoredWeek = {
  assignments: Record<string, { employeeName: string; shifts: AssignedShift[] }>;
  updatedAt: string;
  updatedBy: string;
};

type Store = Record<string, StoredWeek>;

const read = (): Store => readJson<Store>(KEY, {});

function writeWeek(weekStart: string, week: StoredWeek): void {
  writeJson(KEY, { ...read(), [weekStart]: week });
}

function toSchedule(weekStart: string, week: StoredWeek | undefined): PublishedSchedule {
  return {
    weekStart,
    assignments: Object.entries(week?.assignments ?? {})
      .filter(([, value]) => value.shifts.length > 0)
      .map(([employeeId, value]) => ({ employeeId, employeeName: value.employeeName, shifts: value.shifts })),
    updatedAt: week?.updatedAt,
  };
}

export function subscribePublishedSchedule(
  weekStart: string,
  onData: (schedule: PublishedSchedule) => void,
  _onError?: (error: unknown) => void
): () => void {
  let active = true;
  const emit = () => onData(toSchedule(weekStart, read()[weekStart]));
  queueMicrotask(() => {
    if (active) emit();
  });
  const unsubscribe = subscribeKey(KEY, emit);
  return () => {
    active = false;
    unsubscribe();
  };
}

export async function publishEmployeeSchedule(args: {
  weekStart: string;
  employeeId: string;
  employeeName: string;
  shifts: AssignedShift[];
  approvedBy: string;
}): Promise<void> {
  const assignments = { ...(read()[args.weekStart]?.assignments ?? {}) };
  if (args.shifts.length > 0) {
    assignments[args.employeeId] = { employeeName: args.employeeName, shifts: args.shifts };
  } else {
    delete assignments[args.employeeId];
  }
  writeWeek(args.weekStart, { assignments, updatedAt: new Date().toISOString(), updatedBy: args.approvedBy });
}

/** Keep already-published employee assignments aligned with the canonical admin week. */
export function syncPublishedAssignmentsFromWeek(args: {
  weekStart: string;
  employees: Employee[];
  shifts: Shift[];
  approvedBy: string;
  publishAll?: boolean;
}): void {
  const existing = read()[args.weekStart]?.assignments ?? {};
  const employeeIds = args.publishAll
    ? new Set(args.shifts.flatMap((shift) => (shift.employeeId ? [shift.employeeId] : [])))
    : new Set(Object.keys(existing));
  const employeeMap = new Map(args.employees.map((employee) => [employee.id, employee]));
  const assignments: StoredWeek["assignments"] = args.publishAll ? {} : { ...existing };
  for (const employeeId of employeeIds) {
    const shifts = args.shifts
      .filter((shift) => shift.employeeId === employeeId)
      .flatMap((shift) =>
        shift.startMinutes == null || shift.endMinutes == null || shift.location === "unknown"
          ? []
          : [{
              date: shift.date,
              startMinutes: shift.startMinutes,
              endMinutes: shift.endMinutes,
              location: shift.location,
              department: shift.department,
            } satisfies AssignedShift]
      );
    if (shifts.length === 0) {
      delete assignments[employeeId];
      continue;
    }
    assignments[employeeId] = {
      employeeName: employeeMap.get(employeeId)?.displayName ?? employeeId,
      shifts,
    };
  }
  writeWeek(args.weekStart, { assignments, updatedAt: new Date().toISOString(), updatedBy: args.approvedBy });
}
