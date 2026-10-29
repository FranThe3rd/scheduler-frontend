import type {
  Employee,
  Shift,
  StaffingIntervalTarget,
  WeekAvailability,
  LocationCode,
  DayOfWeek,
  ShiftTypeObservation,
  AppSettings,
} from "./types";
import {
  dayOfWeekFromDate,
  newId,
  weekDates,
  intervalsOverlap,
} from "./time";
import {
  availabilityAllowsShift,
  employmentAllowsDate,
  getAvailabilityCell,
  revalidateWeek,
  isSignedOff,
  isAvailabilityCalendarEntered,
} from "./validation";
import {
  canAutoAssignToLocation,
  locationPreferenceScore,
} from "./locationEligibility";
import { lehighPreferenceScore } from "./lehighPreferences";
import {
  canAddLehighDistinctEmployee,
  LEHIGH_MAX_DISTINCT_PER_DAY,
  lehighDistinctCount,
} from "./lehighDailyCap";

export type BuildMode = "build" | "preview_patterns";

export interface BuildScheduleInput {
  weekStart: string;
  employees: Employee[];
  availability: WeekAvailability[];
  targets: StaffingIntervalTarget[];
  lockedShifts: Shift[];
  settings?: Pick<AppSettings, "locationConventionConfirmed" | "unmarkedMeansLinden">;
  mode?: BuildMode;
  /** Normal build requires reviewed availability (or recurring baseline confirmed). */
  availabilityReviewed?: boolean;
  timeoutMs?: number;
}

export interface BuildScheduleResult {
  shifts: Shift[];
  durationMs: number;
  partial: boolean;
  timedOut: boolean;
  blockedReason?: string;
  validation: ReturnType<typeof revalidateWeek>;
}

interface PatternCandidate {
  employeeId: string;
  date: string;
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
  location: LocationCode;
  score: number;
  provisional: boolean;
  pattern: ShiftTypeObservation;
}

function resolveLocation(
  patternLoc: LocationCode | undefined,
  settings?: BuildScheduleInput["settings"]
): LocationCode {
  if (patternLoc === "lehigh") return "lehigh";
  if (patternLoc === "linden") return "linden";
  // Unknown historical notation — do not invent Linden
  if (settings?.locationConventionConfirmed && settings.unmarkedMeansLinden === true) {
    return "linden";
  }
  return "unknown";
}

/** Hard exclusions from manager corrections / roles */
function patternAllowedForEmployee(emp: Employee, st: ShiftTypeObservation): boolean {
  if (emp.autoScheduleEnabled === false) return false;
  if (st.autoScheduleDisabled) return false;
  if (!emp.dna.enabled) return false;

  // Mike: never auto-generate (belt-and-suspenders with autoScheduleEnabled)
  if (emp.id === "emp_mike_wagner") return false;

  // Marques: never automatic 9–1 openings
  if (emp.id === "emp_marques_enriquez") {
    if (st.startMinutes === 9 * 60 && st.endMinutes === 13 * 60) return false;
    if (st.startMinutes < 12 * 60) return false; // no morning openings
  }

  return true;
}

function canAutoSchedule(emp: Employee): boolean {
  if (emp.autoScheduleEnabled === false) return false;
  if (emp.id === "emp_mike_wagner") return false;
  return emp.status === "active" && emp.dna.enabled;
}

function employeeHasFloorShiftOnDay(shifts: Shift[], employeeId: string, date: string): boolean {
  return shifts.some(
    (s) =>
      s.employeeId === employeeId &&
      s.date === date &&
      s.department === "floor" &&
      s.startMinutes != null &&
      s.endMinutes != null
  );
}

function employeeBusy(
  shifts: Shift[],
  employeeId: string,
  date: string,
  start: number,
  end: number
): boolean {
  return shifts.some(
    (s) =>
      s.employeeId === employeeId &&
      s.date === date &&
      s.startMinutes != null &&
      s.endMinutes != null &&
      intervalsOverlap(s.startMinutes, s.endMinutes, start, end)
  );
}

function scorePatternCandidate(
  emp: Employee,
  st: ShiftTypeObservation,
  day: DayOfWeek,
  assignedDays: number,
  assignedHours: number,
  provisional: boolean
): number {
  let score = 10;
  score += Math.min(st.weeksObserved ?? 0, 4) * 8;
  if (st.dayHints.includes(day)) score += 25;
  if (st.location === "lehigh") score += 2;
  if (provisional) score -= 8;
  if (emp.dna.limitedEvidence) score -= 10;

  for (const pref of emp.preferences.filter((p) => p.confirmed)) {
    if (pref.preferredWorkdaysPerWeekMax != null && assignedDays >= pref.preferredWorkdaysPerWeekMax) {
      score -= 80;
    }
    if (pref.preferredWorkdaysPerWeekMin != null && assignedDays < pref.preferredWorkdaysPerWeekMin) {
      score += 12;
    }
  }

  // Soft ceiling from historical averages — not a quota to reach
  if (emp.dna.workload?.approxHoursPerWeek != null && assignedHours >= emp.dna.workload.approxHoursPerWeek) {
    score -= 15;
  }

  // Prefer fewer days already scheduled for distribution (weak)
  score -= assignedDays * 2;

  // Soft: confirmed closers for evening shifts
  if (st.endMinutes >= 21 * 60) {
    const closer = emp.qualifications.some((q) => q.confirmed && q.code === "close");
    if (closer) score += 8;
    else if (emp.qualifications.some((q) => q.code === "close" && !q.confirmed)) {
      score += 2; // unconfirmed closer skill — weak signal only
    }
  }

  const loc = st.location ?? "unknown";
  if (loc === "lehigh" || loc === "linden") {
    score += lehighPreferenceScore(emp, loc, st.startMinutes, st.endMinutes);
    // Occasional Lehi candidates: penalize stacking many Lehi days in one week
    if (loc === "lehigh") {
      const tier = emp.id;
      if (
        tier === "emp_dante_smith" ||
        tier === "emp_alex_cheatham" ||
        tier === "emp_tyson_langensiepen"
      ) {
        score -= assignedDays * 6;
      }
    }
  }

  return score;
}

/**
 * Pattern covers a staffing interval if the employee's usual shift fully covers it
 * or exactly matches it. Never invent unsupported times.
 */
function patternCoversInterval(
  st: ShiftTypeObservation,
  start: number,
  end: number
): boolean {
  return st.startMinutes <= start && st.endMinutes >= end;
}

function collectPatternCandidates(
  input: BuildScheduleInput,
  active: Employee[],
  assignedDays: Map<string, Set<string>>,
  assignedHours: Map<string, number>
): PatternCandidate[] {
  const out: PatternCandidate[] = [];
  const dates = weekDates(input.weekStart);

  for (const emp of active) {
    if (!emp.dna.enabled) continue;
    // Mike IC never auto-generated; floor patterns only if allowed
    for (const st of emp.dna.commonShiftTypes) {
      if (!patternAllowedForEmployee(emp, st)) continue;
      if (!st.dayHints.length) continue;

      for (const date of dates) {
        const day = dayOfWeekFromDate(date);
        if (!st.dayHints.includes(day)) continue;
        if (!employmentAllowsDate(emp, date)) continue;

        const cell = getAvailabilityCell(input.availability, emp.id, date);
        if (isSignedOff(cell)) continue;

        const allow = availabilityAllowsShift(cell, st.startMinutes, st.endMinutes);
        if (!allow.ok && !allow.provisional) continue;
        // Empty availability is OK for preview; for build it is provisional, never "unrestricted"
        if (input.mode !== "preview_patterns" && cell.kind === "unclear") continue;

        const days = assignedDays.get(emp.id)?.size ?? 0;
        const hours = assignedHours.get(emp.id) ?? 0;
        const score = scorePatternCandidate(emp, st, day, days, hours, allow.provisional);

        out.push({
          employeeId: emp.id,
          date,
          day,
          startMinutes: st.startMinutes,
          endMinutes: st.endMinutes,
          location: resolveLocation(st.location, input.settings),
          score,
          provisional: allow.provisional || input.mode === "preview_patterns",
          pattern: st,
        });
      }
    }
  }

  // Prefer stronger evidence first; for same person/day, longer contiguous shifts before nested ones
  out.sort(
    (a, b) =>
      b.score - a.score ||
      b.endMinutes - b.startMinutes - (a.endMinutes - a.startMinutes) ||
      a.date.localeCompare(b.date)
  );
  return out;
}

/**
 * DNA-first scheduler.
 * Does NOT create generic coverage slots and dump arbitrary employees into them.
 * Proposes employee-specific patterns, then optionally tries to cover confirmed targets
 * only with employees whose own patterns cover that interval.
 */
export function buildSchedule(input: BuildScheduleInput): BuildScheduleResult {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 55_000;
  let timedOut = false;
  const mode: BuildMode = input.mode ?? "build";

  if (mode === "build" && !input.availabilityReviewed) {
    const emptyValidation = revalidateWeek({
      shifts: input.lockedShifts,
      availability: input.availability,
      employees: input.employees,
      targets: input.targets,
      weekStart: input.weekStart,
    });
    return {
      shifts: emptyValidation.shifts,
      durationMs: Date.now() - started,
      partial: true,
      timedOut: false,
      blockedReason:
        "Add and review this week’s availability before building. Or use “Preview usual patterns” for an unconfirmed DNA-only draft.",
      validation: emptyValidation,
    };
  }

  const active = input.employees.filter((e) => e.status === "active" && canAutoSchedule(e));
  // Preserve locked/manual Mike (and others) from lockedShifts; never auto-add Mike
  // Server boundary: strip inactive employees from newly generated unlocked shifts
  const shifts: Shift[] = input.lockedShifts
    .filter((s) => {
      // Drop unlocked generated Mike shifts if somehow passed in
      if (s.employeeId === "emp_mike_wagner" && s.source === "generated" && !s.locked) return false;
      if (s.employeeId && s.source === "generated" && !s.locked) {
        const emp = input.employees.find((e) => e.id === s.employeeId);
        if (emp && emp.status !== "active") return false;
      }
      return true;
    })
    .map((s) => ({
      ...s,
      locked: true,
      source: "locked_preserved" as const,
    }));

  const assignedDays = new Map<string, Set<string>>();
  const assignedHours = new Map<string, number>();

  function track(s: Shift) {
    if (!s.employeeId || s.startMinutes == null || s.endMinutes == null) return;
    const days = assignedDays.get(s.employeeId) ?? new Set();
    days.add(s.date);
    assignedDays.set(s.employeeId, days);
    const hrs = (s.endMinutes - s.startMinutes) / 60;
    assignedHours.set(s.employeeId, (assignedHours.get(s.employeeId) ?? 0) + hrs);
  }
  for (const s of shifts) track(s);

  // Phase 1: place employee-specific DNA candidates (one contiguous floor shift per person per day)
  const candidates = collectPatternCandidates(input, active, assignedDays, assignedHours);

  for (const c of candidates) {
    if (Date.now() - started > timeoutMs) {
      timedOut = true;
      break;
    }

    const emp = active.find((e) => e.id === c.employeeId);
    if (!emp) continue;

    // Soft max workdays
    const daysSoFar = assignedDays.get(emp.id)?.size ?? 0;
    const maxPref = emp.preferences.find((p) => p.confirmed)?.preferredWorkdaysPerWeekMax;
    if (maxPref != null && daysSoFar >= maxPref && !assignedDays.get(emp.id)?.has(c.date)) {
      continue;
    }

    // Default: one floor shift per employee per day
    if (employeeHasFloorShiftOnDay(shifts, emp.id, c.date)) continue;
    if (employeeBusy(shifts, emp.id, c.date, c.startMinutes, c.endMinutes)) continue;

    // Confirmed hard limits
    let limited = false;
    for (const lim of emp.limits.filter((l) => l.confirmed)) {
      if (lim.maxDaysPerWeek != null) {
        const days = assignedDays.get(emp.id) ?? new Set();
        if (!days.has(c.date) && days.size >= lim.maxDaysPerWeek) limited = true;
      }
      if (lim.maxHoursPerWeek != null) {
        const hrs = assignedHours.get(emp.id) ?? 0;
        const add = (c.endMinutes - c.startMinutes) / 60;
        if (hrs + add > lim.maxHoursPerWeek) limited = true;
      }
    }
    if (limited) continue;

    // Skip weak scores for preview/build alike — don't force low-quality fills
    if (c.score < 5) continue;

    // In real builds, do not park unmarked DNA as "unknown" (blocks store coverage fills).
    // Only place patterns with an explicit location; phase 2 assigns by confirmed store targets.
    // Preview may still show unknown-location DNA preferences.
    if (mode === "build" && c.location === "unknown") continue;
    if (mode === "build" && !canAutoAssignToLocation(emp, c.location)) continue;
    if (
      c.location === "lehigh" &&
      !canAddLehighDistinctEmployee(shifts, c.date, emp.id)
    ) {
      continue;
    }

    shifts.push({
      id: newId("shift"),
      employeeId: emp.id,
      date: c.date,
      startMinutes: c.startMinutes,
      endMinutes: c.endMinutes,
      location: c.location,
      department: "floor",
      locked: false,
      provisionalAvailability: c.provisional,
      source: "generated",
      notes:
        mode === "preview_patterns"
          ? "Preview from usual patterns — unconfirmed availability"
          : undefined,
    });
    track(shifts[shifts.length - 1]!);
  }

  // Phase 2: fill confirmed staffing targets only with DNA-compatible employees
  // Never invent unsupported shift times. Leave gaps visible when no pattern fits.
  const confirmedTargets = input.targets.filter(
    (t) => t.enabled && t.confirmed && t.department === "floor"
  );

  if (mode === "build" && confirmedTargets.length > 0 && !timedOut) {
    for (const date of weekDates(input.weekStart)) {
      if (Date.now() - started > timeoutMs) {
        timedOut = true;
        break;
      }
      const day = dayOfWeekFromDate(date);
      for (const t of confirmedTargets.filter((x) => x.day === day || x.day === "any")) {
        const loc =
          t.location === "unknown"
            ? resolveLocation(undefined, input.settings)
            : t.location;

        const uniqueCovering = () => {
          const ids = new Set<string>();
          for (const s of shifts) {
            if (
              s.date === date &&
              s.department === "floor" &&
              s.employeeId &&
              s.location === loc &&
              s.startMinutes != null &&
              s.endMinutes != null &&
              intervalsOverlap(s.startMinutes, s.endMinutes, t.startMinutes, t.endMinutes)
            ) {
              ids.add(s.employeeId);
            }
          }
          return ids.size;
        };

        let have = uniqueCovering();
        const goal = t.minimum;

        while (have < goal) {
          if (Date.now() - started > timeoutMs) {
            timedOut = true;
            break;
          }

          let best: PatternCandidate | null = null;
          for (const emp of active) {
            if (!canAutoSchedule(emp)) continue;
            if (!canAutoAssignToLocation(emp, loc)) continue;
            if (!employmentAllowsDate(emp, date)) continue;
            if (employeeHasFloorShiftOnDay(shifts, emp.id, date)) continue;
            if (
              loc === "lehigh" &&
              !canAddLehighDistinctEmployee(shifts, date, emp.id)
            ) {
              continue;
            }

            const cell = getAvailabilityCell(input.availability, emp.id, date);
            if (isSignedOff(cell)) continue;

            for (const st of emp.dna.commonShiftTypes) {
              if (!patternAllowedForEmployee(emp, st)) continue;
              // dayHints are preferences, not hard bans — coverage fills must try
              // any pattern that covers the required interval (Mon Lehigh 12–4).
              if (!patternCoversInterval(st, t.startMinutes, t.endMinutes)) continue;

              const start = st.startMinutes;
              const end = st.endMinutes;
              const allow = availabilityAllowsShift(cell, start, end);
              if (!allow.ok && !allow.provisional) continue;
              if (employeeBusy(shifts, emp.id, date, start, end)) continue;

              const days = assignedDays.get(emp.id)?.size ?? 0;
              const maxPref = emp.preferences.find((p) => p.confirmed)?.preferredWorkdaysPerWeekMax;
              if (maxPref != null && days >= maxPref && !assignedDays.get(emp.id)?.has(date)) {
                continue;
              }

              const hours = assignedHours.get(emp.id) ?? 0;
              let score =
                scorePatternCandidate(emp, st, day, days, hours, allow.provisional) + 20;
              // Soft preference for usual day
              if (!st.dayHints.includes(day)) score -= 12;
              const candLoc = resolveLocation(st.location ?? loc, input.settings);
              score += locationPreferenceScore(emp, loc);
              score += lehighPreferenceScore(emp, loc, start, end);
              // Prefer reusing someone already on Lehi today (does not raise distinct count)
              if (loc === "lehigh" && lehighDistinctCount(shifts, date) > 0) {
                const already = shifts.some(
                  (s) =>
                    s.date === date &&
                    s.location === "lehigh" &&
                    s.employeeId === emp.id
                );
                if (already) score += 25;
                else if (lehighDistinctCount(shifts, date) >= 2) score -= 8;
              }
              const cand: PatternCandidate = {
                employeeId: emp.id,
                date,
                day,
                startMinutes: start,
                endMinutes: end,
                location: candLoc,
                score,
                provisional: allow.provisional,
                pattern: st,
              };
              // Prefer exact location match when target is Lehigh
              if (loc === "lehigh" && cand.location !== "lehigh") cand.score -= 15;
              if (loc === "lehigh" && cand.location === "lehigh") cand.score += 10;
              if (loc === "linden" && cand.location === "linden") cand.score += 5;
              if (!best || cand.score > best.score) best = cand;
            }
          }

          // Soften threshold for coverage: prefer a lower-score fit over an empty
          // required interval when the employee is eligible and available.
          if (!best) break;
          if (best.score < 0) break; // accept any non-negative coverage fit
          if (
            loc === "lehigh" &&
            !canAddLehighDistinctEmployee(shifts, date, best.employeeId)
          ) {
            break;
          }

          shifts.push({
            id: newId("shift"),
            employeeId: best.employeeId,
            date: best.date,
            startMinutes: best.startMinutes,
            endMinutes: best.endMinutes,
            // Coverage fills belong to the target store; DNA location only guides candidate scoring
            location: loc === "unknown" ? resolveLocation(best.location, input.settings) : loc,
            department: "floor",
            locked: false,
            provisionalAvailability: best.provisional,
            source: "generated",
          });
          track(shifts[shifts.length - 1]!);
          const nextHave = uniqueCovering();
          if (nextHave <= have) break; // safety: avoid infinite loop if cover did not increase
          have = nextHave;
        }

        // Shortage repair: eligible free employees with a covering DNA pattern,
        // ignoring soft dayHint penalties (minimum coverage before preferred days).
        have = uniqueCovering();
        while (have < goal) {
          if (Date.now() - started > timeoutMs) {
            timedOut = true;
            break;
          }
          let repair: PatternCandidate | null = null;
          for (const emp of active) {
            if (!canAutoSchedule(emp)) continue;
            if (!canAutoAssignToLocation(emp, loc)) continue;
            if (!employmentAllowsDate(emp, date)) continue;
            if (employeeHasFloorShiftOnDay(shifts, emp.id, date)) continue;
            if (
              loc === "lehigh" &&
              !canAddLehighDistinctEmployee(shifts, date, emp.id)
            ) {
              continue;
            }
            const cell = getAvailabilityCell(input.availability, emp.id, date);
            if (isSignedOff(cell)) continue;
            for (const st of emp.dna.commonShiftTypes) {
              if (!patternAllowedForEmployee(emp, st)) continue;
              if (!patternCoversInterval(st, t.startMinutes, t.endMinutes)) continue;
              const allow = availabilityAllowsShift(cell, st.startMinutes, st.endMinutes);
              if (!allow.ok && !allow.provisional) continue;
              if (employeeBusy(shifts, emp.id, date, st.startMinutes, st.endMinutes)) continue;
              const candLoc = resolveLocation(st.location ?? loc, input.settings);
              let score = 30 + locationPreferenceScore(emp, loc);
              score += lehighPreferenceScore(emp, loc, st.startMinutes, st.endMinutes);
              if (st.dayHints.includes(day)) score += 10;
              if (loc === "lehigh" && candLoc === "lehigh") score += 20;
              if (loc === "lehigh" && candLoc !== "lehigh") score += 5;
              if (allow.provisional) score -= 5;
              const cand: PatternCandidate = {
                employeeId: emp.id,
                date,
                day,
                startMinutes: st.startMinutes,
                endMinutes: st.endMinutes,
                location: candLoc,
                score,
                provisional: allow.provisional,
                pattern: st,
              };
              if (!repair || cand.score > repair.score) repair = cand;
            }
          }
          if (!repair) break;
          if (
            loc === "lehigh" &&
            !canAddLehighDistinctEmployee(shifts, date, repair.employeeId)
          ) {
            break;
          }
          shifts.push({
            id: newId("shift"),
            employeeId: repair.employeeId,
            date: repair.date,
            startMinutes: repair.startMinutes,
            endMinutes: repair.endMinutes,
            location: loc === "unknown" ? resolveLocation(repair.location, input.settings) : loc,
            department: "floor",
            locked: false,
            provisionalAvailability: repair.provisional,
            source: "generated",
            notes: "Coverage repair — minimum staffing",
          });
          track(shifts[shifts.length - 1]!);
          const nextHave = uniqueCovering();
          if (nextHave <= have) break;
          have = nextHave;
        }
      }
    }
  }

  const durationMs = Date.now() - started;
  const validation = revalidateWeek({
    shifts,
    availability: input.availability,
    employees: input.employees,
    targets: input.targets,
    weekStart: input.weekStart,
  });

  const partial =
    validation.coverage.some((c) => c.status === "below_minimum") ||
    validation.issues.some((i) => i.severity === "shortage") ||
    confirmedTargets.length === 0;

  return {
    shifts: validation.shifts,
    durationMs,
    partial,
    timedOut,
    validation,
  };
}

export function findReplacementCandidates(args: {
  date: string;
  startMinutes: number;
  endMinutes: number;
  location: LocationCode;
  department: "floor" | "ic";
  employees: Employee[];
  availability: WeekAvailability[];
  shifts: Shift[];
  requiredQualification?: string;
}): import("./types").ReplacementCandidate[] {
  const out: import("./types").ReplacementCandidate[] = [];
  for (const emp of args.employees.filter((e) => e.status === "active")) {
    if (emp.autoScheduleEnabled === false && args.department === "floor") continue;
    if (emp.id === "emp_mike_wagner" && args.department === "floor") continue;
    if (
      args.department === "floor" &&
      (args.location === "lehigh" || args.location === "linden") &&
      !canAutoAssignToLocation(emp, args.location)
    ) {
      continue;
    }
    if (!employmentAllowsDate(emp, args.date)) continue;
    const cell = getAvailabilityCell(args.availability, emp.id, args.date);
    if (isSignedOff(cell)) continue;
    if (employeeBusy(args.shifts, emp.id, args.date, args.startMinutes, args.endMinutes)) {
      continue;
    }
    if (args.requiredQualification) {
      const ok = emp.qualifications.some(
        (q) => q.confirmed && q.code === args.requiredQualification
      );
      if (!ok) continue;
    }
    let blocked = false;
    for (const lim of emp.limits.filter((l) => l.confirmed)) {
      if (lim.earliestStartMinutes != null && args.startMinutes < lim.earliestStartMinutes)
        blocked = true;
      if (lim.latestEndMinutes != null && args.endMinutes > lim.latestEndMinutes) blocked = true;
    }
    if (blocked) continue;

    const allow = availabilityAllowsShift(cell, args.startMinutes, args.endMinutes);
    if (!allow.ok && !allow.provisional) continue;

    if (allow.ok && !allow.provisional) {
      out.push({
        employeeId: emp.id,
        displayName: emp.displayName,
        status: "confirmed_available",
        reason: `Fits confirmed availability${cell.note ? ` (${cell.note})` : ""}.`,
      });
    } else {
      out.push({
        employeeId: emp.id,
        displayName: emp.displayName,
        status: "needs_availability_check",
        reason: "No confirmed sign-off conflict, but availability is not confirmed for this day.",
      });
    }
  }
  return out.sort((a, b) => {
    if (a.status === b.status) return a.displayName.localeCompare(b.displayName);
    return a.status === "confirmed_available" ? -1 : 1;
  });
}

export { isAvailabilityCalendarEntered };
