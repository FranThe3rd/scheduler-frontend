import { SCHEDULE_ROSTER_ORDER } from "./mock/oct2025Schedule";
import { shiftToCellText } from "./shiftCellText";
import { weekDates } from "./time";
import type { Employee, Shift, WeekSchedule } from "./types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type ScheduleGridRow = {
  key: string;
  label: string;
  employeeId: string | null;
};

export function buildScheduleGridRows(
  employees: Employee[],
  shifts: Shift[] = []
): ScheduleGridRow[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const onRoster = new Set<string>();
  const scheduledEmployeeIds = new Set(
    shifts.flatMap((shift) => (shift.employeeId ? [shift.employeeId] : []))
  );
  const unresolvedLabels = new Set(
    shifts
      .filter((shift) => shift.employeeId === null && shift.unresolvedLabel)
      .map((shift) => shift.unresolvedLabel!)
  );
  const out: ScheduleGridRow[] = [];
  for (const line of SCHEDULE_ROSTER_ORDER) {
    if (line.kind === "employee") {
      const e = byId.get(line.employeeId);
      if (!e || (e.status !== "active" && !scheduledEmployeeIds.has(e.id))) continue;
      onRoster.add(e.id);
      out.push({
        key: e.id,
        label: e.sharedHistoricalLabel ? e.displayName : e.printedLabel,
        employeeId: e.id,
      });
    } else {
      if (!unresolvedLabels.has(line.label)) continue;
      out.push({
        key: `unresolved_${line.label}`,
        label: line.label,
        employeeId: null,
      });
    }
  }
  const rosterIndex = new Map(employees.map((e, i) => [e.id, i]));
  const added: ScheduleGridRow[] = employees
    .filter(
      (e) =>
        e.status === "active" &&
        !onRoster.has(e.id)
    )
    .sort(
      (a, b) =>
        (rosterIndex.get(b.id) ?? 0) - (rosterIndex.get(a.id) ?? 0)
    )
    .map((e) => ({
      key: e.id,
      label: e.sharedHistoricalLabel ? e.displayName : e.printedLabel,
      employeeId: e.id,
    }));

  const knownUnresolved = new Set(
    SCHEDULE_ROSTER_ORDER
      .filter((line) => line.kind === "unresolved")
      .map((line) => line.label)
  );
  const additionalUnresolved: ScheduleGridRow[] = [...unresolvedLabels]
    .filter((label) => !knownUnresolved.has(label))
    .sort((a, b) => a.localeCompare(b))
    .map((label) => ({
      key: `unresolved_${label}`,
      label,
      employeeId: null,
    }));

  return [...added, ...out, ...additionalUnresolved];
}

export function shiftsForScheduleCell(
  shifts: Shift[],
  employeeId: string | null,
  unresolvedLabel: string | undefined,
  date: string
): Shift[] {
  return shifts.filter((s) => {
    if (s.date !== date) return false;
    if (employeeId) return s.employeeId === employeeId;
    return s.employeeId == null && s.unresolvedLabel === unresolvedLabel;
  });
}

export function getScheduleCellDisplay(
  week: WeekSchedule,
  row: ScheduleGridRow,
  date: string,
  shifts: Shift[]
): string {
  const matched = shiftsForScheduleCell(
    shifts,
    row.employeeId,
    row.employeeId ? undefined : row.label,
    date
  );
  if (matched.length > 0) {
    return matched.map(shiftToCellText).join("\n");
  }
  if (row.employeeId) {
    const avail = week.availability.find((a) => a.employeeId === row.employeeId);
    const cell = avail?.cells[date];
    if (cell?.kind === "unclear") return "Unclear";
  }
  return "—";
}

export function buildScheduleTableMatrix(
  week: WeekSchedule,
  employees: Employee[],
  shifts: Shift[] = week.shifts
): { headers: string[]; body: string[][]; dates: string[] } {
  const dates = weekDates(week.weekStart);
  const gridRows = buildScheduleGridRows(employees, shifts);
  const headers = [
    "Employee",
    ...dates.map((d, i) => {
      const short = d.slice(5).replace("-", "/");
      return `${DAY_NAMES[i]!.slice(0, 3)} ${short}`;
    }),
  ];
  const body = gridRows.map((row) => [
    row.label,
    ...dates.map((d) => getScheduleCellDisplay(week, row, d, shifts)),
  ]);
  return { headers, body, dates };
}

export function scheduleExportFilename(weekStart: string, ext: string): string {
  return `dairy-schedule-${weekStart}.${ext}`;
}
