import type { DayOfWeek, Employee, RecurringAvailability } from "./types";
import { minutesToLabel } from "./time";

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * One-time baseline windows from roster DNA usual patterns.
 * Does not invent school schedules — only copies observed DNA shift windows per day.
 * Empty days stay without a window (not all-day available).
 */
export function deriveRecurringFromDna(emp: Employee): RecurringAvailability[] {
  const byDay = new Map<
    DayOfWeek,
    { startMinutes: number; endMinutes: number; weeksObserved: number }
  >();

  for (const st of emp.dna?.commonShiftTypes ?? []) {
    if (st.autoScheduleDisabled) continue;
    if (st.startMinutes == null || st.endMinutes == null) continue;
    const weight = st.weeksObserved ?? 1;
    for (const day of st.dayHints ?? []) {
      const cur = byDay.get(day);
      // Prefer the more-observed window; on ties keep the earlier start (typical open)
      if (
        !cur ||
        weight > cur.weeksObserved ||
        (weight === cur.weeksObserved && st.startMinutes < cur.startMinutes)
      ) {
        byDay.set(day, {
          startMinutes: st.startMinutes,
          endMinutes: st.endMinutes,
          weeksObserved: weight,
        });
      }
    }
  }

  const out: RecurringAvailability[] = [];
  for (const day of DAYS) {
    const w = byDay.get(day);
    if (!w) continue;
    out.push({
      day,
      kind: "window",
      window: { startMinutes: w.startMinutes, endMinutes: w.endMinutes },
      note: `Usual ${minutesToLabel(w.startMinutes)}–${minutesToLabel(w.endMinutes)} (DNA baseline)`,
      enabled: true,
    });
  }
  return out;
}

/**
 * Fill missing employee recurringAvailability from DNA once.
 * Never overwrites an employee who already has enabled recurring rows.
 */
export function ensureRecurringBaselineFromDna(employees: Employee[]): number {
  let filled = 0;
  for (const emp of employees) {
    if (emp.status !== "active") continue;
    const hasEnabled = (emp.recurringAvailability ?? []).some((r) => r.enabled);
    if (hasEnabled) continue;
    const derived = deriveRecurringFromDna(emp);
    if (derived.length === 0) continue;
    emp.recurringAvailability = derived;
    filled += 1;
  }
  return filled;
}
