import type {
  AvailabilityCell,
  Employee,
  ScheduleIssue,
  Shift,
  StaffingIntervalTarget,
  WeekAvailability,
  CoverageIntervalResult,
  EmployeeTotals,
  ScheduleExplanation,
  LocationCode,
  DayOfWeek,
} from "./types";
import {
  dayOfWeekFromDate,
  intervalsOverlap,
  shiftDurationHours,
  shiftsOverlap,
  weekDates,
  newId,
  minutesToLabel,
} from "./time";
import { openingHoursFor } from "./openingHours";
import { locationEligibilityConflictMessage } from "./locationEligibility";
import {
  LEHIGH_MAX_DISTINCT_PER_DAY,
  lehighDistinctCount,
  lehighDistinctEmployeeIds,
} from "./lehighDailyCap";

export function emptyWeekAvailability(
  employees: Employee[],
  weekStart: string
): WeekAvailability[] {
  const dates = weekDates(weekStart);
  return employees
    .filter((e) => e.status === "active")
    .map((e) => ({
      employeeId: e.id,
      cells: Object.fromEntries(
        dates.map((d) => [d, { kind: "empty" as const }])
      ),
    }));
}

export function getAvailabilityCell(
  availability: WeekAvailability[],
  employeeId: string,
  date: string
): AvailabilityCell {
  const row = availability.find((a) => a.employeeId === employeeId);
  return row?.cells[date] ?? { kind: "empty" };
}

export function isSignedOff(cell: AvailabilityCell): boolean {
  return cell.kind === "off";
}

/** Can this employee work this timed shift under confirmed availability? */
export function availabilityAllowsShift(
  cell: AvailabilityCell,
  start: number,
  end: number
): { ok: boolean; provisional: boolean; reason?: string } {
  if (cell.kind === "off") {
    return { ok: false, provisional: false, reason: "Signed off" };
  }
  if (cell.kind === "unclear") {
    return { ok: false, provisional: true, reason: "Availability note needs review" };
  }
  if (cell.kind === "empty" || cell.kind === "open") {
    // Empty = no restriction recorded; not confirmed available
    return { ok: true, provisional: true, reason: "Availability not confirmed for this day" };
  }
  if (cell.kind === "unrestricted") {
    return { ok: true, provisional: false };
  }
  if (cell.kind === "after" && cell.window) {
    if (start < cell.window.startMinutes) {
      return { ok: false, provisional: false, reason: `Available after ${cell.note ?? "restriction"}` };
    }
    return { ok: true, provisional: false };
  }
  if (cell.kind === "until" && cell.window) {
    if (end > cell.window.endMinutes) {
      return { ok: false, provisional: false, reason: `Available until ${cell.note ?? "restriction"}` };
    }
    return { ok: true, provisional: false };
  }
  if (cell.kind === "window" && cell.window) {
    if (start < cell.window.startMinutes || end > cell.window.endMinutes) {
      return {
        ok: false,
        provisional: false,
        reason: `Outside availability window ${cell.note ?? ""}`.trim(),
      };
    }
    return { ok: true, provisional: false };
  }
  return { ok: true, provisional: true };
}

export function employmentAllowsDate(employee: Employee, date: string): boolean {
  if (employee.status !== "active") return false;
  if (employee.employmentEndDate && date > employee.employmentEndDate) return false;
  return true;
}

export function computeTotals(shifts: Shift[]): EmployeeTotals[] {
  const map = new Map<string, EmployeeTotals>();
  for (const s of shifts) {
    if (!s.employeeId) continue;
    const cur = map.get(s.employeeId) ?? {
      employeeId: s.employeeId,
      hours: 0,
      workdays: 0,
      shifts: 0,
    };
    cur.hours += shiftDurationHours(s.startMinutes, s.endMinutes);
    cur.shifts += 1;
    map.set(s.employeeId, cur);
  }
  for (const t of map.values()) {
    const days = new Set(
      shifts.filter((s) => s.employeeId === t.employeeId).map((s) => s.date)
    );
    t.workdays = days.size;
    t.hours = Math.round(t.hours * 100) / 100;
  }
  return [...map.values()];
}

export function findOverlaps(shifts: Shift[]): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const byEmp = new Map<string, Shift[]>();
  for (const s of shifts) {
    if (!s.employeeId) continue;
    const list = byEmp.get(s.employeeId) ?? [];
    list.push(s);
    byEmp.set(s.employeeId, list);
  }
  for (const [employeeId, list] of byEmp) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (a.date !== b.date) continue;
        if (a.missingTiming || b.missingTiming) {
          issues.push({
            id: newId("issue"),
            severity: "hard",
            code: "ic_timing_unknown",
            message:
              "An IC or shift entry is missing times, so overlap checking is incomplete.",
            employeeId,
            date: a.date,
            shiftId: a.id,
          });
          continue;
        }
        if (shiftsOverlap(a, b)) {
          issues.push({
            id: newId("issue"),
            severity: "hard",
            code: "overlap",
            message:
              "Overlapping assignments across locations/departments for the same person.",
            employeeId,
            date: a.date,
            shiftId: a.id,
            startMinutes: a.startMinutes ?? undefined,
            endMinutes: a.endMinutes ?? undefined,
          });
        }
      }
    }
  }
  return issues;
}

export function isAvailabilityCalendarEntered(
  availability: WeekAvailability[]
): boolean {
  return availability.some((row) =>
    Object.values(row.cells).some((c) => c.kind !== "empty")
  );
}

export function validateShiftsAgainstAvailability(
  shifts: Shift[],
  availability: WeekAvailability[],
  employees: Employee[]
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  for (const s of shifts) {
    if (!s.employeeId) {
      issues.push({
        id: newId("issue"),
        severity: "hard",
        code: "unresolved_employee",
        message: `Unresolved assignment (${s.unresolvedLabel ?? "unknown"}). Choose Lexi or Brooke — never both.`,
        date: s.date,
        shiftId: s.id,
      });
      continue;
    }
    const emp = employees.find((e) => e.id === s.employeeId);
    if (!emp) continue;
    if (!employmentAllowsDate(emp, s.date)) {
      issues.push({
        id: newId("issue"),
        severity: "hard",
        code: "employment_ended",
        message: `${emp.displayName} cannot be scheduled after employment end date.`,
        employeeId: emp.id,
        date: s.date,
        shiftId: s.id,
      });
    }
    if (s.department === "ic" && (s.startMinutes == null || s.endMinutes == null)) {
      issues.push({
        id: newId("issue"),
        severity: "hard",
        code: "ic_missing_timing",
        message: `IC assignment for ${emp.displayName} is missing times.`,
        employeeId: emp.id,
        date: s.date,
        shiftId: s.id,
      });
    }
    if (s.location === "unknown") {
      issues.push({
        id: newId("issue"),
        severity: "soft",
        code: "unknown_location",
        message: `${emp.displayName} on ${s.date}: location is unknown — confirm Linden or Lehigh.`,
        employeeId: emp.id,
        date: s.date,
        shiftId: s.id,
        location: "unknown",
      });
    }
    if (s.location === "lehigh" || s.location === "linden") {
      const locConflict = locationEligibilityConflictMessage(emp, s.location);
      if (locConflict) {
        const isManual = s.source === "manual" || s.locked;
        issues.push({
          id: newId("issue"),
          severity: isManual ? "soft" : "hard",
          code: isManual ? "location_override" : "location_eligibility",
          message: isManual
            ? `${locConflict} (manual override — confirm this is intentional).`
            : locConflict,
          employeeId: emp.id,
          date: s.date,
          shiftId: s.id,
          location: s.location,
        });
      }
    }
    if (s.startMinutes == null || s.endMinutes == null) continue;
    const cell = getAvailabilityCell(availability, emp.id, s.date);
    const allow = availabilityAllowsShift(cell, s.startMinutes, s.endMinutes);
    if (!allow.ok && !allow.provisional) {
      issues.push({
        id: newId("issue"),
        severity: "hard",
        code: "availability_conflict",
        message: `${emp.displayName}: ${allow.reason}`,
        employeeId: emp.id,
        date: s.date,
        shiftId: s.id,
      });
    } else if (allow.provisional || s.provisionalAvailability) {
      // Empty/Open/unclear — DNA patterns are not confirmed availability
      issues.push({
        id: newId("issue"),
        severity: "soft",
        code: "unconfirmed_availability",
        message: `${emp.displayName} on ${s.date}: check availability (not confirmed on the calendar). Historical patterns are not confirmed availability.`,
        employeeId: emp.id,
        date: s.date,
        shiftId: s.id,
      });
    }
    // Confirmed limits
    for (const lim of emp.limits.filter((l) => l.confirmed)) {
      if (lim.effectiveFrom && s.date < lim.effectiveFrom) continue;
      if (lim.effectiveTo && s.date > lim.effectiveTo) continue;
      if (lim.earliestStartMinutes != null && s.startMinutes < lim.earliestStartMinutes) {
        issues.push({
          id: newId("issue"),
          severity: "hard",
          code: "limit_start",
          message: `${emp.displayName} starts before confirmed limit.`,
          employeeId: emp.id,
          shiftId: s.id,
          date: s.date,
        });
      }
      if (lim.latestEndMinutes != null && s.endMinutes > lim.latestEndMinutes) {
        issues.push({
          id: newId("issue"),
          severity: "hard",
          code: "limit_end",
          message: `${emp.displayName} ends after confirmed limit.`,
          employeeId: emp.id,
          shiftId: s.id,
          date: s.date,
        });
      }
    }
  }

  // Weekly limit checks
  const totals = computeTotals(shifts);
  for (const t of totals) {
    const emp = employees.find((e) => e.id === t.employeeId);
    if (!emp) continue;
    for (const lim of emp.limits.filter((l) => l.confirmed)) {
      if (lim.maxHoursPerWeek != null && t.hours > lim.maxHoursPerWeek + 0.01) {
        issues.push({
          id: newId("issue"),
          severity: "hard",
          code: "limit_hours",
          message: `${emp.displayName} exceeds confirmed max hours (${lim.maxHoursPerWeek}).`,
          employeeId: emp.id,
        });
      }
      if (lim.maxDaysPerWeek != null && t.workdays > lim.maxDaysPerWeek) {
        issues.push({
          id: newId("issue"),
          severity: "hard",
          code: "limit_days",
          message: `${emp.displayName} exceeds confirmed max workdays (${lim.maxDaysPerWeek}).`,
          employeeId: emp.id,
        });
      }
    }
  }

  return issues;
}

/**
 * Coverage uses floor department only — IC must not inflate floor coverage.
 * Splits each location’s opening-hours window at staffing-target and assignment
 * boundaries so gaps (e.g. Mon 4–6, Sat daytime, Sun evening) cannot disappear.
 */
export function computeCoverage(
  shifts: Shift[],
  targets: StaffingIntervalTarget[],
  weekStart: string,
  employees?: Employee[],
  availability?: WeekAvailability[]
): CoverageIntervalResult[] {
  const dates = weekDates(weekStart);
  const enabled = targets.filter((t) => t.enabled && t.confirmed && t.department === "floor");
  const results: CoverageIntervalResult[] = [];

  for (const date of dates) {
    const day = dayOfWeekFromDate(date);
    for (const loc of ["linden", "lehigh"] as LocationCode[]) {
      const hours = openingHoursFor(loc, day);
      if (!hours) continue;

      const dayTargets = enabled.filter(
        (t) =>
          t.location === loc &&
          (t.day === day || t.day === "any") &&
          t.startMinutes < hours.closeMinutes &&
          t.endMinutes > hours.openMinutes
      );

      // Boundary points: open, close, every target edge, every floor shift edge
      const points = new Set<number>([hours.openMinutes, hours.closeMinutes]);
      for (const t of dayTargets) {
        points.add(Math.max(hours.openMinutes, t.startMinutes));
        points.add(Math.min(hours.closeMinutes, t.endMinutes));
      }
      for (const s of floorShiftsOnDay(shifts, date, loc)) {
        if (s.startMinutes! > hours.openMinutes && s.startMinutes! < hours.closeMinutes) {
          points.add(s.startMinutes!);
        }
        if (s.endMinutes! > hours.openMinutes && s.endMinutes! < hours.closeMinutes) {
          points.add(s.endMinutes!);
        }
      }
      const sorted = [...points].sort((a, b) => a - b);

      for (let i = 0; i < sorted.length - 1; i++) {
        const start = sorted[i]!;
        const end = sorted[i + 1]!;
        if (end <= start) continue;
        if (start < hours.openMinutes || end > hours.closeMinutes) continue;

        const coveringTargets = dayTargets.filter(
          (t) => t.startMinutes <= start && t.endMinutes >= end
        );
        // Concurrent headcount: take the strictest (max) minimum among overlapping targets
        let minimum = 0;
        let desired = 0;
        let hasTarget = false;
        for (const t of coveringTargets) {
          hasTarget = true;
          minimum = Math.max(minimum, t.minimum);
          desired = Math.max(desired, t.desired);
        }

        const covering = coveringFloorIds(shifts, date, loc, start, end);
        const count = covering.size;

        let status: CoverageIntervalResult["status"];
        let unfilledReason: string | undefined;

        if (!hasTarget) {
          if (count === 0) {
            status = "unstaffed_open";
            minimum = 1; // display as short for zero-staff open interval
            desired = 1;
            unfilledReason = `Staffing target missing for ${loc === "lehigh" ? "Lehi" : "Main"} ${minutesToLabel(start)}–${minutesToLabel(end)} (${hours.source}). Zero staff during opening hours.`;
          } else {
            status = "staffing_target_missing";
            minimum = 0;
            desired = 0;
            unfilledReason = `Staffing target missing for ${loc === "lehigh" ? "Lehi" : "Main"} ${minutesToLabel(start)}–${minutesToLabel(end)} (${hours.source}). ${count} assigned — configure a minimum before calling this covered.`;
          }
        } else if (count < minimum) {
          status = "below_minimum";
          if (employees && availability) {
            unfilledReason = diagnoseUnfilledGap({
              date,
              location: loc,
              startMinutes: start,
              endMinutes: end,
              need: minimum - count,
              have: count,
              employees,
              availability,
              shifts,
            });
          }
        } else if (desired > minimum && count < desired) {
          status = "minimum_met";
        } else if (count === desired) {
          status = "desired_met";
        } else if (count > desired) {
          status = "excess";
        } else {
          status = "minimum_met";
        }

        // Ineligible assignees spoil a green result
        if (
          employees &&
          (status === "minimum_met" || status === "desired_met" || status === "excess")
        ) {
          for (const id of covering) {
            const emp = employees.find((e) => e.id === id);
            if (!emp) continue;
            const conflict = locationEligibilityConflictMessage(emp, loc);
            if (conflict) {
              status = "below_minimum";
              unfilledReason = conflict;
              break;
            }
          }
        }

        results.push({
          date,
          location: loc,
          department: "floor",
          startMinutes: start,
          endMinutes: end,
          count,
          minimum,
          desired: Math.max(desired, minimum),
          status,
          unfilledReason,
          assignedEmployeeIds: [...covering],
          fromOpeningHours: true,
        });
      }
    }
  }

  return results;
}

/** Explain why a coverage gap was left rather than inventing availability or violating sign-offs. */
export function diagnoseUnfilledGap(args: {
  date: string;
  location: LocationCode;
  startMinutes: number;
  endMinutes: number;
  need: number;
  have: number;
  employees: Employee[];
  availability: WeekAvailability[];
  shifts: Shift[];
}): string {
  const day = dayOfWeekFromDate(args.date);
  const slot = `${minutesToLabel(args.startMinutes)}–${minutesToLabel(args.endMinutes)}`;
  const reasons: string[] = [];
  let signedOff = 0;
  let windowBlocked = 0;
  let unclear = 0;
  let alreadyBusy = 0;
  let noDnaCover = 0;
  let dnaElsewhere = 0;

  for (const emp of args.employees.filter((e) => e.status === "active")) {
    if (emp.id === "emp_mike_wagner") continue;
    if (!employmentAllowsDate(emp, args.date)) continue;
    const cell = getAvailabilityCell(args.availability, emp.id, args.date);
    if (isSignedOff(cell)) {
      signedOff += 1;
      continue;
    }
    if (cell.kind === "unclear") {
      unclear += 1;
      continue;
    }

    const coveringDna = emp.dna.commonShiftTypes.filter((st) => {
      if (!st.dayHints.includes(day)) return false;
      return st.startMinutes <= args.startMinutes && st.endMinutes >= args.endMinutes;
    });
    if (coveringDna.length === 0) {
      noDnaCover += 1;
      continue;
    }

    const busyElsewhere = args.shifts.some(
      (s) =>
        s.employeeId === emp.id &&
        s.date === args.date &&
        s.startMinutes != null &&
        s.endMinutes != null &&
        intervalsOverlap(s.startMinutes, s.endMinutes, args.startMinutes, args.endMinutes)
    );
    if (busyElsewhere) {
      alreadyBusy += 1;
      continue;
    }

    const floorElsewhere = args.shifts.some(
      (s) =>
        s.employeeId === emp.id &&
        s.date === args.date &&
        s.department === "floor" &&
        s.location !== args.location
    );
    if (floorElsewhere) {
      dnaElsewhere += 1;
      continue;
    }

    let anyWindowOk = false;
    for (const st of coveringDna) {
      const allow = availabilityAllowsShift(cell, st.startMinutes, st.endMinutes);
      if (allow.ok || allow.provisional) {
        anyWindowOk = true;
        break;
      }
    }
    if (!anyWindowOk) windowBlocked += 1;
  }

  if (signedOff > 0) reasons.push(`${signedOff} signed off`);
  if (unclear > 0) reasons.push(`${unclear} unclear note(s) still need correction`);
  if (alreadyBusy > 0) reasons.push(`${alreadyBusy} already assigned overlapping time (any location)`);
  if (dnaElsewhere > 0) reasons.push(`${dnaElsewhere} already on floor at the other store`);
  if (windowBlocked > 0) reasons.push(`${windowBlocked} blocked by partial-day availability`);
  if (noDnaCover > 0) reasons.push(`${noDnaCover} have no usual DNA pattern covering ${slot}`);

  const detail =
    reasons.length > 0
      ? reasons.join("; ")
      : `no employee with a DNA pattern covering ${slot} could be assigned without inventing availability`;

  return `Need ${args.need} more at ${args.location === "lehigh" ? "Lehi" : args.location === "linden" ? "Main" : args.location} ${slot} (${args.have}/${args.have + args.need}): ${detail}. Did not invent availability or override sign-offs.`;
}

function floorShiftsOnDay(shifts: Shift[], date: string, location: LocationCode): Shift[] {
  return shifts.filter(
    (s) =>
      s.date === date &&
      s.department === "floor" &&
      s.location === location &&
      s.employeeId &&
      s.startMinutes != null &&
      s.endMinutes != null
  );
}

/** Unique employees covering a probe instant */
function minSimultaneousFloor(
  shifts: Shift[],
  date: string,
  location: LocationCode,
  start: number,
  end: number
): number {
  return coveringFloorIds(shifts, date, location, start, end).size;
}

/** Employee IDs at the weakest simultaneous coverage probe in [start, end). */
function coveringFloorIds(
  shifts: Shift[],
  date: string,
  location: LocationCode,
  start: number,
  end: number
): Set<string> {
  const list = floorShiftsOnDay(shifts, date, location);
  const points = new Set<number>([start, end]);
  for (const s of list) {
    if (s.startMinutes! > start && s.startMinutes! < end) points.add(s.startMinutes!);
    if (s.endMinutes! > start && s.endMinutes! < end) points.add(s.endMinutes!);
  }
  const sorted = [...points].sort((a, b) => a - b);
  let min = Infinity;
  let worst = new Set<string>();
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (b <= a) continue;
    const probe = a;
    if (probe >= end) continue;
    const ids = new Set(
      list
        .filter((s) => s.startMinutes! <= probe && s.endMinutes! > probe)
        .map((s) => s.employeeId!)
    );
    if (ids.size < min) {
      min = ids.size;
      worst = ids;
    }
  }
  if (min === Infinity) {
    return new Set(
      list
        .filter((s) => s.startMinutes! <= start && s.endMinutes! > start)
        .map((s) => s.employeeId!)
    );
  }
  return worst;
}

export function softPreferenceWarnings(
  shifts: Shift[],
  employees: Employee[]
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const totals = computeTotals(shifts);
  for (const t of totals) {
    const emp = employees.find((e) => e.id === t.employeeId);
    if (!emp) continue;
    for (const pref of emp.preferences.filter((p) => p.confirmed)) {
      if (
        pref.preferredWorkdaysPerWeekMax != null &&
        t.workdays > pref.preferredWorkdaysPerWeekMax
      ) {
        issues.push({
          id: newId("issue"),
          severity: "soft",
          code: "pref_days_high",
          message: `${emp.displayName} is above preferred workdays (${pref.preferredWorkdaysPerWeekMax}).`,
          employeeId: emp.id,
        });
      }
      if (
        pref.preferredWorkdaysPerWeekMin != null &&
        t.workdays < pref.preferredWorkdaysPerWeekMin
      ) {
        issues.push({
          id: newId("issue"),
          severity: "soft",
          code: "pref_days_low",
          message: `${emp.displayName} is below preferred workdays (${pref.preferredWorkdaysPerWeekMin}).`,
          employeeId: emp.id,
        });
      }
    }
  }
  return issues;
}

export function buildExplanation(
  shifts: Shift[],
  coverage: CoverageIntervalResult[],
  availability: WeekAvailability[],
  employees: Employee[],
  issues: ScheduleIssue[]
): ScheduleExplanation {
  const bullets: string[] = [];
  const totals = computeTotals(shifts);
  const floorShifts = shifts.filter((s) => s.department === "floor" && s.employeeId);
  const calendarEntered = isAvailabilityCalendarEntered(availability);

  bullets.push(
    `${floorShifts.length} floor shifts totaling ${totals.reduce((s, t) => s + t.hours, 0).toFixed(1)} staff hours.`
  );

  if (!calendarEntered) {
    bullets.push(
      "Provisional draft — availability not confirmed. No sign-off calendar was entered for this week. Historical DNA is a soft pattern only, not confirmed availability."
    );
  }

  // Preserved familiar patterns — clearly soft / historical
  let familiar = 0;
  for (const s of floorShifts) {
    const emp = employees.find((e) => e.id === s.employeeId);
    if (!emp || !emp.dna.enabled || s.startMinutes == null || s.endMinutes == null) continue;
    const day = dayOfWeekFromDate(s.date);
    const hit = emp.dna.commonShiftTypes.some(
      (t) =>
        t.startMinutes === s.startMinutes &&
        t.endMinutes === s.endMinutes &&
        (t.dayHints.length === 0 || t.dayHints.includes(day))
    );
    if (hit) familiar += 1;
  }
  if (familiar > 0) {
    bullets.push(
      `${familiar} shifts follow familiar historical timing patterns (soft preference only — not confirmed availability).`
    );
  }

  const marques = totals.find((t) => t.employeeId === "emp_marques_enriquez");
  if (marques) {
    bullets.push(
      `Marques is scheduled ${marques.workdays} workday${marques.workdays === 1 ? "" : "s"} (preference about 3–4).`
    );
  }

  const desiredMet = coverage.filter((c) => c.status === "desired_met" || c.status === "excess").length;
  const below = coverage.filter((c) => c.status === "below_minimum").length;
  const confirmedTargets = coverage.filter((c) => c.status !== "no_target");
  if (confirmedTargets.length > 0) {
    bullets.push(
      `${desiredMet} coverage intervals meet desired staffing; ${below} remain below minimum.`
    );
  } else {
    bullets.push(
      "Staffing targets are not yet confirmed — coverage counts are shown for reference only."
    );
  }

  const unresolvedAvailability = issues.filter((i) => i.code === "unconfirmed_availability").length;
  const unresolvedLocation = issues.filter((i) => i.code === "unknown_location").length;
  const provisional = unresolvedAvailability;

  const hard = issues.filter((i) => i.severity === "hard");
  const allAvailabilityHonored =
    calendarEntered &&
    hard.filter((i) => i.code === "availability_conflict").length === 0 &&
    unresolvedAvailability === 0;

  if (allAvailabilityHonored) {
    bullets.push("All assignments were checked against confirmed availability.");
  } else if (unresolvedAvailability > 0) {
    bullets.push(
      `${unresolvedAvailability} assignment(s) need availability checked — empty calendar cells and historical DNA are not confirmed availability.`
    );
  }

  if (unresolvedLocation > 0) {
    bullets.push(
      `${unresolvedLocation} assignment(s) have an unknown location that still needs confirmation.`
    );
  }

  const provisionalDraft = !calendarEntered || unresolvedAvailability > 0;

  return {
    bullets,
    allAvailabilityHonored,
    provisionalCount: provisional,
    unresolvedAvailabilityCount: unresolvedAvailability,
    unresolvedLocationCount: unresolvedLocation,
    availabilityCalendarEntered: calendarEntered,
    provisionalDraft,
  };
}

export function revalidateWeek(args: {
  shifts: Shift[];
  availability: WeekAvailability[];
  employees: Employee[];
  targets: StaffingIntervalTarget[];
  weekStart: string;
}): {
  shifts: Shift[];
  issues: ScheduleIssue[];
  coverage: CoverageIntervalResult[];
  totals: EmployeeTotals[];
  explanation: ScheduleExplanation;
} {
  // Sync provisionalAvailability from current calendar (DNA is never confirmation)
  const syncedShifts = args.shifts.map((s) => {
    if (!s.employeeId || s.startMinutes == null || s.endMinutes == null) {
      return {
        ...s,
        provisionalAvailability:
          s.department === "ic" && (s.startMinutes == null || s.endMinutes == null)
            ? true
            : s.provisionalAvailability ?? true,
      };
    }
    const cell = getAvailabilityCell(args.availability, s.employeeId, s.date);
    const allow = availabilityAllowsShift(cell, s.startMinutes, s.endMinutes);
    return {
      ...s,
      provisionalAvailability: Boolean(allow.provisional),
    };
  });

  const overlaps = findOverlaps(syncedShifts);
  const avail = validateShiftsAgainstAvailability(
    syncedShifts,
    args.availability,
    args.employees
  );
  const soft = softPreferenceWarnings(syncedShifts, args.employees);
  const coverage = computeCoverage(
    syncedShifts,
    args.targets,
    args.weekStart,
    args.employees,
    args.availability
  );

  const shortageIssues: ScheduleIssue[] = coverage
    .filter(
      (c) =>
        c.status === "below_minimum" ||
        c.status === "unstaffed_open" ||
        c.status === "staffing_target_missing"
    )
    .map((c) => ({
      id: newId("issue"),
      severity: "shortage" as const,
      code:
        c.status === "staffing_target_missing"
          ? "staffing_target_missing"
          : c.status === "unstaffed_open"
            ? "unstaffed_open"
            : "coverage_short",
      message:
        c.unfilledReason ??
        `Below minimum at ${c.location} on ${c.date} (${c.count}/${c.minimum}).`,
      date: c.date,
      startMinutes: c.startMinutes,
      endMinutes: c.endMinutes,
      location: c.location,
      department: c.department,
    }));

  // Lehi daily distinct-employee cap (≤3 automatic). Manual overrides flagged soft.
  const lehighCapIssues: ScheduleIssue[] = [];
  for (const date of weekDates(args.weekStart)) {
    const ids = lehighDistinctEmployeeIds(syncedShifts, date);
    if (ids.size <= LEHIGH_MAX_DISTINCT_PER_DAY) continue;
    const autoIds = [...ids].filter((id) =>
      syncedShifts.some(
        (s) =>
          s.date === date &&
          s.location === "lehigh" &&
          s.employeeId === id &&
          s.source === "generated" &&
          !s.locked
      )
    );
    const severity = autoIds.length > 0 ? ("hard" as const) : ("soft" as const);
    lehighCapIssues.push({
      id: newId("issue"),
      severity,
      code: "lehigh_daily_cap",
      message:
        severity === "hard"
          ? `Lehi on ${date}: ${ids.size} distinct employees (cap ${LEHIGH_MAX_DISTINCT_PER_DAY} for automatic generation). Reduce or lock intentional extras.`
          : `Lehi on ${date}: ${ids.size} distinct employees (above usual ${LEHIGH_MAX_DISTINCT_PER_DAY}) via manual override — confirm intentional.`,
      date,
      location: "lehigh",
      department: "floor",
    });
  }

  // Closing-interval qualifications: require confirmed closer skills when present;
  // otherwise surface missing data (do not invent).
  const closingSkillIssues: ScheduleIssue[] = [];
  const anyoneHasCloseQual = args.employees.some((e) =>
    e.qualifications.some((q) => q.code === "close")
  );
  if (anyoneHasCloseQual) {
    for (const date of weekDates(args.weekStart)) {
      for (const loc of ["linden", "lehigh"] as LocationCode[]) {
        const hours = openingHoursFor(loc, dayOfWeekFromDate(date));
        if (!hours) continue;
        const closeStart = Math.max(hours.openMinutes, 18 * 60);
        const closeEnd = hours.closeMinutes;
        if (closeEnd <= closeStart) continue;
        const onClose = syncedShifts.filter(
          (s) =>
            s.date === date &&
            s.location === loc &&
            s.department === "floor" &&
            s.employeeId &&
            s.startMinutes != null &&
            s.endMinutes != null &&
            intervalsOverlap(s.startMinutes, s.endMinutes, closeStart, closeEnd)
        );
        if (onClose.length === 0) continue;
        const confirmedClosers = onClose.filter((s) => {
          const emp = args.employees.find((e) => e.id === s.employeeId);
          return emp?.qualifications.some((q) => q.confirmed && q.code === "close");
        });
        if (confirmedClosers.length === 0) {
          closingSkillIssues.push({
            id: newId("issue"),
            severity: "soft",
            code: "closing_qualification_missing",
            message: `${loc === "lehigh" ? "Lehi" : "Main"} ${date} ${minutesToLabel(closeStart)}–${minutesToLabel(closeEnd)}: no assigned employee has a confirmed closing qualification — configure skills on employee profiles.`,
            date,
            startMinutes: closeStart,
            endMinutes: closeEnd,
            location: loc,
            department: "floor",
          });
        }
      }
    }
  }

  const issues = [
    ...overlaps,
    ...avail,
    ...soft,
    ...shortageIssues,
    ...lehighCapIssues,
    ...closingSkillIssues,
  ];
  const totals = computeTotals(syncedShifts);
  const explanation = buildExplanation(
    syncedShifts,
    coverage,
    args.availability,
    args.employees,
    issues
  );

  return { shifts: syncedShifts, issues, coverage, totals, explanation };
}

export function dayLabel(day: DayOfWeek): string {
  return day.charAt(0).toUpperCase() + day.slice(1, 3);
}
