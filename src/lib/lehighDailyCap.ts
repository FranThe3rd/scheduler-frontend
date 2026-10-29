import type { Shift } from "./types";

/**
 * Manager intent (Oct 2026): Lehi normally uses 2–3 distinct employees per day,
 * never more than 3 in automatic generation. This is a headcount of people,
 * not concurrent staffing in a time block.
 */
export const LEHIGH_MAX_DISTINCT_PER_DAY = 3;

/** Distinct floor employee IDs already assigned to Lehi on a date. */
export function lehighDistinctEmployeeIds(shifts: Shift[], date: string): Set<string> {
  const ids = new Set<string>();
  for (const s of shifts) {
    if (
      s.date === date &&
      s.location === "lehigh" &&
      s.department === "floor" &&
      s.employeeId
    ) {
      ids.add(s.employeeId);
    }
  }
  return ids;
}

/**
 * Whether adding this employee to Lehi on this date would stay within the
 * automatic distinct-person cap. Already-assigned people may receive
 * additional/non-overlapping Lehi shifts without increasing the count.
 */
export function canAddLehighDistinctEmployee(
  shifts: Shift[],
  date: string,
  employeeId: string,
  opts?: { max?: number }
): boolean {
  const max = opts?.max ?? LEHIGH_MAX_DISTINCT_PER_DAY;
  const ids = lehighDistinctEmployeeIds(shifts, date);
  if (ids.has(employeeId)) return true;
  return ids.size < max;
}

export function lehighDistinctCount(shifts: Shift[], date: string): number {
  return lehighDistinctEmployeeIds(shifts, date).size;
}
