import type { Employee, LocationCode } from "./types";

/**
 * Confirmed automatic location permissions/prohibitions.
 * Usual patterns are preferences (DNA); these are hard generation constraints.
 *
 * Oct 2026 update: Dante is no longer hard-banned from Lehi — Main is usual,
 * occasional Lehi is allowed. Mike remains excluded from all auto assignment.
 */

/** Never auto-assign these people (any location). */
const AUTO_EXCLUDED_IDS = new Set<string>(["emp_mike_wagner"]);

/**
 * Established Lehi staff with regular or frequent evidence.
 * Preference for Lehi fills — not a closed allow-list alone.
 */
export const LEHIGH_USUAL_IDS = new Set<string>([
  "emp_brady_dologite", // Brady Dol. — strong Lehi
  "emp_clausnitzer", // B. Clausnitzer — strong daytime
  "emp_makary", // F. Makary — ~2 daytime weekly (provisional)
  "emp_josh_roman", // Jordan — occasional evening
  "emp_calvin_rittle", // occasional
  "emp_noah_miller", // occasional
]);

/** Occasional Lehi candidates (eligible, not routine daily). */
export const LEHIGH_OCCASIONAL_IDS = new Set<string>([
  "emp_dante_smith",
  "emp_alex_cheatham",
  "emp_tyson_langensiepen",
  "emp_aja_saez",
  "emp_alexis_horvath",
]);

export function isMikeExcluded(emp: Employee): boolean {
  return emp.id === "emp_mike_wagner" || emp.autoScheduleEnabled === false;
}

/** @deprecated Dante is no longer hard-prohibited from Lehi. Kept for soft checks. */
export function isLehighAutoProhibited(emp: Employee): boolean {
  return AUTO_EXCLUDED_IDS.has(emp.id);
}

export function hasLehighEvidence(emp: Employee): boolean {
  if (LEHIGH_USUAL_IDS.has(emp.id)) return true;
  if (LEHIGH_OCCASIONAL_IDS.has(emp.id)) return true;
  if ((emp.dna.lehighEvidenceNotes?.length ?? 0) > 0) return true;
  return emp.dna.commonShiftTypes.some((st) => st.location === "lehigh");
}

/**
 * Hard check for automatic assignment to a location (initial, repair, swap, regen).
 * Manual assignments bypass this but validation flags Mike/exclusion conflicts.
 */
export function canAutoAssignToLocation(emp: Employee, location: LocationCode): boolean {
  if (emp.status !== "active") return false;
  if (emp.autoScheduleEnabled === false) return false;
  if (emp.id === "emp_mike_wagner") return false;
  if (location === "lehigh") {
    if (!hasLehighEvidence(emp)) return false;
  }
  return true;
}

/** Soft preference score adjustment for location fit (legacy entry point). */
export function locationPreferenceScore(emp: Employee, location: LocationCode): number {
  if (location === "lehigh") {
    if (emp.id === "emp_mike_wagner") return -1000;
    if (LEHIGH_USUAL_IDS.has(emp.id)) return 25;
    if (LEHIGH_OCCASIONAL_IDS.has(emp.id)) return 8;
    if (hasLehighEvidence(emp)) return 12;
    return -20;
  }
  if (location === "linden" && (emp.id === "emp_dante_smith" || emp.id === "emp_alex_cheatham")) {
    return 15;
  }
  return 0;
}

/** Human-readable conflict when an excluded person is on a location. */
export function locationEligibilityConflictMessage(
  emp: Employee,
  location: LocationCode
): string | null {
  if (emp.id === "emp_mike_wagner") {
    return `Mike is excluded from automatic assignments — keep only if deliberately locked.`;
  }
  if (location === "lehigh" && !hasLehighEvidence(emp)) {
    return `${emp.displayName} has no confirmed Lehi eligibility — assignment requires Mike’s explicit override.`;
  }
  return null;
}
