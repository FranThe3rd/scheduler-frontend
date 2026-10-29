import type { Employee, LocationCode } from "./types";
import { LEHIGH_USUAL_IDS } from "./locationEligibility";

/**
 * Soft Lehi preference tiers from manager + Oct 5–11 paper.
 * Hard eligibility remains canAutoAssignToLocation; these adjust scoring only.
 */
export type LehighPreferenceTier =
  | "strong"
  | "daytime"
  | "evening_occasional"
  | "occasional"
  | "main_usual"
  | "none";

const STRONG_LEHIGH = new Set<string>([
  "emp_brady_dologite", // Brady Dol. — strong Lehi preference
]);

const DAYTIME_LEHIGH = new Set<string>([
  "emp_clausnitzer", // B. Clausnitzer — noon–5 L evidence
  "emp_makary", // F. Makary — ~2 Lehi daytime weekly (provisional)
]);

const EVENING_OCCASIONAL = new Set<string>([
  "emp_josh_roman", // Jordan — ~1–2 evening weekly when available
  "emp_tyson_langensiepen", // Tyson — occasional closing L (Oct paper)
]);

const OCCASIONAL_LEHIGH = new Set<string>([
  "emp_calvin_rittle",
  "emp_noah_miller",
  "emp_alex_cheatham", // primarily Main; occasional Lehi (Tue 1–6 L)
  "emp_dante_smith", // Main usual; occasional Lehi (Thu noon–6 L)
  "emp_aja_saez", // Oct paper evening L
  "emp_alexis_horvath", // Oct paper evening L
]);

export function lehighPreferenceTier(emp: Employee): LehighPreferenceTier {
  if (STRONG_LEHIGH.has(emp.id)) return "strong";
  if (DAYTIME_LEHIGH.has(emp.id)) return "daytime";
  if (EVENING_OCCASIONAL.has(emp.id)) return "evening_occasional";
  if (OCCASIONAL_LEHIGH.has(emp.id) || LEHIGH_USUAL_IDS.has(emp.id)) return "occasional";
  if (emp.id === "emp_dante_smith" || emp.id === "emp_alex_cheatham") return "main_usual";
  if ((emp.dna.lehighEvidenceNotes?.length ?? 0) > 0) return "occasional";
  if (emp.dna.commonShiftTypes.some((st) => st.location === "lehigh")) return "occasional";
  return "none";
}

/** Score adjustment for Lehi placement — prefer strong/usual without flooding occasional Main staff. */
export function lehighPreferenceScore(
  emp: Employee,
  location: LocationCode,
  startMinutes: number,
  endMinutes: number
): number {
  if (location !== "lehigh") {
    if (location === "linden" && (emp.id === "emp_dante_smith" || emp.id === "emp_alex_cheatham")) {
      return 12;
    }
    return 0;
  }
  const tier = lehighPreferenceTier(emp);
  const mid = (startMinutes + endMinutes) / 2;
  const isDaytime = mid < 17 * 60;
  const isEvening = startMinutes >= 17 * 60 || endMinutes > 18 * 60;

  switch (tier) {
    case "strong":
      return 30;
    case "daytime":
      return isDaytime ? 28 : 8;
    case "evening_occasional":
      return isEvening ? 18 : 6;
    case "occasional":
      // Occasional Lehi OK but not default daily — soft preference only
      return 10;
    case "main_usual":
      return 6;
    default:
      return -25;
  }
}
