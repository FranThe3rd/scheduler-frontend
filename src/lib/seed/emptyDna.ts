import type { EmployeeDna } from "../types";

/** Disabled DNA stub — simple schedule maker does not use historical patterns. */
export function emptyEmployeeDna(): EmployeeDna {
  return {
    source: "",
    yearNeedsConfirmation: false,
    lehighEvidenceNotes: [],
    limitedEvidence: false,
    enabled: false,
    commonShiftTypes: [],
    weekdayObservations: [],
  };
}
