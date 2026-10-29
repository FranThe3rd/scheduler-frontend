import { createEmployee } from "./createEmployee";
import type { PublishedSchedule } from "./publishedSchedules";
import type { ScheduleRequest } from "./scheduleRequests";
import type { Employee, Shift, WeekSchedule } from "./types";

function assignedToShifts(
  employeeId: string,
  sourceId: string,
  assigned: Array<{
    date: string;
    startMinutes: number;
    endMinutes: number;
    location: Shift["location"];
    department: Shift["department"];
  }>
): Shift[] {
  return assigned.map((shift) => ({
    id: `${sourceId}-${employeeId}-${shift.date}`,
    employeeId,
    date: shift.date,
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
    location: shift.location,
    department: shift.department,
    locked: true,
    source: "manual",
  }));
}

function employeeIdsIn(shifts: Shift[]): Set<string> {
  return new Set(shifts.flatMap((shift) => (shift.employeeId ? [shift.employeeId] : [])));
}

function addMissingEmployee(employees: Employee[], id: string, name: string): void {
  if (employees.some((employee) => employee.id === id)) return;
  employees.push({
    ...createEmployee({
      displayName: name,
      printedLabel: name,
      colorIndex: employees.length,
    }),
    id,
  });
}

/**
 * One merge rule for every admin and staff schedule view:
 * canonical week shifts win, then published assignments, then approved requests.
 */
export function mergeTeamSchedule(args: {
  week: WeekSchedule;
  employees: Employee[];
  published?: PublishedSchedule | null;
  approvedRequests?: ScheduleRequest[];
}): { week: WeekSchedule; employees: Employee[]; shifts: Shift[] } {
  const employees = [...args.employees];
  const baseShifts = args.week.shifts.length > 0 ? args.week.shifts : args.week.approvedSnapshot ?? [];
  const present = employeeIdsIn(baseShifts);
  const extra: Shift[] = [];

  for (const assignment of args.published?.assignments ?? []) {
    addMissingEmployee(employees, assignment.employeeId, assignment.employeeName);
    if (present.has(assignment.employeeId)) continue;
    extra.push(...assignedToShifts(assignment.employeeId, "published", assignment.shifts));
    present.add(assignment.employeeId);
  }

  for (const request of args.approvedRequests ?? []) {
    if (request.status !== "approved" || request.assignedShifts.length === 0) continue;
    addMissingEmployee(employees, request.uid, request.name);
    if (present.has(request.uid)) continue;
    extra.push(...assignedToShifts(request.uid, `approved-${request.id}`, request.assignedShifts));
    present.add(request.uid);
  }

  const shifts = [...baseShifts, ...extra];
  const week: WeekSchedule = {
    ...args.week,
    shifts,
    status:
      extra.length > 0 && args.week.status === "draft" ? "approved" : args.week.status,
    approvedAt:
      args.week.approvedAt ??
      args.published?.updatedAt ??
      (args.approvedRequests ?? [])
        .map((request) => request.decidedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1),
    approvedSnapshot: extra.length > 0 ? shifts : args.week.approvedSnapshot,
  };
  return { week, employees, shifts };
}
