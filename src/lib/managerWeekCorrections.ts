/**
 * Manager-confirmed availability corrections for the Sep 14–20, 2026 test week only.
 * These are manual overrides for that week — not recurring DNA and not general OCR rules.
 */
import type { AppData, AvailabilityCell } from "./types";
import { weekDates } from "./time";

export const SEP14_TEST_WEEK = "2026-09-14";

const OFF: AvailabilityCell = { kind: "off", note: "Off", source: "manual" };

/** Verified full-day offs for the Sep 14–20 fixture (manager-confirmed). */
const VERIFIED_OFFS: Record<string, string[]> = {
  emp_addy_giesler: [
    "2026-09-14", // Mon
    "2026-09-16", // Wed
    "2026-09-18", // Fri
    "2026-09-20", // Sun
  ],
  emp_alexis_horvath: [
    "2026-09-19", // Sat
    "2026-09-20", // Sun
  ],
  emp_calvin_rittle: [
    "2026-09-19", // Sat
    "2026-09-20", // Sun
  ],
  emp_josh_roman: [
    "2026-09-14",
    "2026-09-15",
    "2026-09-16",
    "2026-09-17",
    "2026-09-18",
    "2026-09-19",
    "2026-09-20",
  ],
};

/** Incorrect OCR Xs that must be cleared for this fixture (not signed off). */
const CLEAR_FALSE_OFFS: Record<string, string[]> = {
  emp_addy_giesler: ["2026-09-15"], // Tue — false X
};

/**
 * Apply manager-confirmed Sep 14–20 sign-offs. Preserves other employees' cells.
 * Does not invent recurring restrictions.
 */
export function applySep14ManagerCorrections(data: AppData): { mutated: boolean } {
  const week = data.weeks.find((w) => w.weekStart === SEP14_TEST_WEEK);
  if (!week) return { mutated: false };

  let mutated = false;
  const dates = new Set(weekDates(SEP14_TEST_WEEK));
  const target = week;

  function ensureRow(employeeId: string) {
    let row = target.availability.find((a) => a.employeeId === employeeId);
    if (!row) {
      row = { employeeId, cells: {} };
      target.availability.push(row);
    }
    return row;
  }

  for (const [employeeId, clearDates] of Object.entries(CLEAR_FALSE_OFFS)) {
    const row = ensureRow(employeeId);
    for (const d of clearDates) {
      if (!dates.has(d)) continue;
      const cur = row.cells[d];
      if (cur?.kind === "off" && cur.source !== "manual") {
        // Clear false photo X — leave empty so usual windows apply
        row.cells[d] = { kind: "empty", source: "manual" };
        mutated = true;
      } else if (cur?.kind === "off" && cur.source === "manual" && cur.note === "Off") {
        // If a prior false correction exists as photo, already handled; if it's the false Tue
        // and somehow manual, still clear per verified list (Tue is not in verified offs)
        if (!VERIFIED_OFFS[employeeId]?.includes(d)) {
          row.cells[d] = { kind: "empty", source: "manual" };
          mutated = true;
        }
      }
    }
  }

  for (const [employeeId, offDates] of Object.entries(VERIFIED_OFFS)) {
    const row = ensureRow(employeeId);
    for (const d of offDates) {
      if (!dates.has(d)) continue;
      const cur = row.cells[d];
      if (cur?.kind === "off" && cur.source === "manual") continue;
      row.cells[d] = { ...OFF };
      mutated = true;
    }
  }

  // John misread → Jordan for this upload only: ensure no John employee; Jordan already has Sun
  week.availability = week.availability.filter((a) => a.employeeId !== "emp_john");

  if (mutated) {
    week.availabilityReviewed = true;
  }
  return { mutated };
}

/** Ground-truth map for regression tests (employeeId → off ISO dates). */
export function sep14VerifiedOffMap(): Record<string, string[]> {
  return { ...VERIFIED_OFFS };
}
