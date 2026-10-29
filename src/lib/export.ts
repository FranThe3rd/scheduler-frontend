import type { Employee, Shift, WeekSchedule } from "./types";
import { formatShiftTimes, dayOfWeekFromDate, minutesToLabel } from "./time";

function locationSuffix(location: Shift["location"]): string {
  if (location === "lehigh") return "L";
  if (location === "unknown") return "?";
  return "";
}

function deptNote(s: Shift): string {
  if (s.department === "ic") return "IC";
  return "";
}

export function shiftExportLabel(s: Shift, employees: Employee[]): string {
  const emp = employees.find((e) => e.id === s.employeeId);
  const name = emp?.printedLabel ?? s.unresolvedLabel ?? "Unresolved";
  const times = formatShiftTimes(s.startMinutes, s.endMinutes);
  const loc = locationSuffix(s.location);
  const ic = deptNote(s);
  const parts = [name, times + loc];
  if (ic) parts.push(ic);
  return parts.join(" ");
}

export function toCsv(week: WeekSchedule, employees: Employee[]): string {
  const header = ["Date", "Weekday", "Employee", "Printed label", "Start", "End", "Location", "Department", "Notes"];
  const rows = [...week.shifts]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startMinutes ?? 0) - (b.startMinutes ?? 0))
    .map((s) => {
      const emp = employees.find((e) => e.id === s.employeeId);
      return [
        s.date,
        dayOfWeekFromDate(s.date),
        emp?.displayName ?? s.unresolvedLabel ?? "",
        emp?.printedLabel ?? "",
        s.startMinutes != null ? minutesToLabel(s.startMinutes) : "",
        s.endMinutes != null ? minutesToLabel(s.endMinutes) : "",
        s.location,
        s.department,
        s.notes ?? "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",");
    });
  return [header.join(","), ...rows].join("\n");
}

export function approvedShiftsMatch(week: WeekSchedule): Shift[] {
  return week.approvedSnapshot ?? week.shifts;
}
