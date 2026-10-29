/**
 * Oct 5–11, 2026 printed weekly schedule — pattern evidence only.
 * Source: IMG_0113.heic (Bethlehem Dairy Store wall sheet).
 * Not availability and not a mandatory recurring template.
 *
 * Manager-confirmed corrections applied:
 * - A. Cheatham Tue = 1–6 L (not ambiguous 7–6 L)
 * - F. Makary / B. Clausnitzer printed labels
 * - Lexy/Brooke is a shared printed row (two people)
 */
import type { DayOfWeek, Employee, LocationCode } from "../types";
import { dayOfWeekFromDate } from "../time";

export type HistoricalShiftEvidence = {
  employeeId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  location: LocationCode;
  department: "floor" | "ic";
  raw: string;
  source: "oct5_11_2026_paper";
  uncertain?: boolean;
  notes?: string;
};

function hm(h: number, m = 0) {
  return h * 60 + m;
}

/** Confirmed / high-confidence assignments from the Oct 5–11 paper. */
export const OCT_5_11_2026_HISTORY: HistoricalShiftEvidence[] = [
  // Monday 10/5
  { employeeId: "emp_marietta_zweifel", date: "2026-10-05", startMinutes: hm(9), endMinutes: hm(13), location: "linden", department: "floor", raw: "9-1", source: "oct5_11_2026_paper" },
  { employeeId: "emp_clausnitzer", date: "2026-10-05", startMinutes: hm(12), endMinutes: hm(17), location: "lehigh", department: "floor", raw: "12-5L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_jenn_stone", date: "2026-10-05", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_mike_wagner", date: "2026-10-05", startMinutes: 0, endMinutes: 0, location: "linden", department: "ic", raw: "IC", source: "oct5_11_2026_paper", notes: "IC — times not on sheet" },
  { employeeId: "emp_brady_dosedlo", date: "2026-10-05", startMinutes: hm(12), endMinutes: hm(18), location: "linden", department: "floor", raw: "12-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_tom_deangelis", date: "2026-10-05", startMinutes: hm(13), endMinutes: hm(18), location: "linden", department: "floor", raw: "1-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_alex_cheatham", date: "2026-10-05", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_naliyah_bennick", date: "2026-10-05", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_calvin_rittle", date: "2026-10-05", startMinutes: hm(19), endMinutes: hm(22), location: "linden", department: "floor", raw: "7-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_noah_miller", date: "2026-10-05", startMinutes: hm(17), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "5-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_alexis_horvath", date: "2026-10-05", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_emily_braido", date: "2026-10-05", startMinutes: hm(19), endMinutes: hm(22), location: "linden", department: "floor", raw: "7-10", source: "oct5_11_2026_paper" },

  // Tuesday 10/6
  { employeeId: "emp_marietta_zweifel", date: "2026-10-06", startMinutes: hm(12), endMinutes: hm(15), location: "linden", department: "floor", raw: "12-3", source: "oct5_11_2026_paper" },
  { employeeId: "emp_mike_wagner", date: "2026-10-06", startMinutes: 0, endMinutes: 0, location: "linden", department: "ic", raw: "IC", source: "oct5_11_2026_paper" },
  { employeeId: "emp_brady_dosedlo", date: "2026-10-06", startMinutes: hm(9), endMinutes: hm(15), location: "linden", department: "floor", raw: "9-3", source: "oct5_11_2026_paper" },
  { employeeId: "emp_lexi", date: "2026-10-06", startMinutes: hm(19), endMinutes: hm(22), location: "linden", department: "floor", raw: "7-10", source: "oct5_11_2026_paper", notes: "Lexy/Brooke shared row — Lexi evening pattern" },
  { employeeId: "emp_dante_smith", date: "2026-10-06", startMinutes: 0, endMinutes: 0, location: "linden", department: "ic", raw: "IC", source: "oct5_11_2026_paper" },
  { employeeId: "emp_tom_deangelis", date: "2026-10-06", startMinutes: hm(19), endMinutes: hm(22), location: "linden", department: "floor", raw: "7-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_marques_enriquez", date: "2026-10-06", startMinutes: hm(15), endMinutes: hm(18), location: "linden", department: "floor", raw: "3-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_addy_giesler", date: "2026-10-06", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_alex_cheatham", date: "2026-10-06", startMinutes: hm(13), endMinutes: hm(18), location: "lehigh", department: "floor", raw: "1-6L", source: "oct5_11_2026_paper", notes: "Manager-confirmed Tue 1–6 L" },
  { employeeId: "emp_naliyah_bennick", date: "2026-10-06", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_calvin_rittle", date: "2026-10-06", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_noah_miller", date: "2026-10-06", startMinutes: hm(15), endMinutes: hm(18), location: "linden", department: "floor", raw: "3-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_tyson_langensiepen", date: "2026-10-06", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_aja_saez", date: "2026-10-06", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },

  // Wednesday 10/7
  { employeeId: "emp_marietta_zweifel", date: "2026-10-07", startMinutes: hm(9), endMinutes: hm(13), location: "linden", department: "floor", raw: "9-1", source: "oct5_11_2026_paper" },
  { employeeId: "emp_clausnitzer", date: "2026-10-07", startMinutes: hm(12), endMinutes: hm(17), location: "lehigh", department: "floor", raw: "12-5L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_jenn_stone", date: "2026-10-07", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_brady_dosedlo", date: "2026-10-07", startMinutes: hm(12), endMinutes: hm(18), location: "linden", department: "floor", raw: "12-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_tom_deangelis", date: "2026-10-07", startMinutes: hm(13), endMinutes: hm(18), location: "linden", department: "floor", raw: "1-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_brady_dologite", date: "2026-10-07", startMinutes: hm(17), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "5-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_marques_enriquez", date: "2026-10-07", startMinutes: hm(19), endMinutes: hm(22), location: "linden", department: "floor", raw: "7-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_lucas_cramer", date: "2026-10-07", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_alex_cheatham", date: "2026-10-07", startMinutes: hm(19), endMinutes: hm(22), location: "linden", department: "floor", raw: "7-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_kourtney_cantrel", date: "2026-10-07", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },

  // Thursday 10/8
  { employeeId: "emp_marietta_zweifel", date: "2026-10-08", startMinutes: hm(12), endMinutes: hm(15), location: "linden", department: "floor", raw: "12-3", source: "oct5_11_2026_paper" },
  { employeeId: "emp_brady_dosedlo", date: "2026-10-08", startMinutes: hm(9), endMinutes: hm(15), location: "linden", department: "floor", raw: "9-3", source: "oct5_11_2026_paper" },
  { employeeId: "emp_lexi", date: "2026-10-08", startMinutes: hm(19), endMinutes: hm(22), location: "linden", department: "floor", raw: "7-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_dante_smith", date: "2026-10-08", startMinutes: hm(12), endMinutes: hm(18), location: "lehigh", department: "floor", raw: "12-6L", source: "oct5_11_2026_paper", notes: "Manager: occasional Lehi" },
  { employeeId: "emp_lucas_cramer", date: "2026-10-08", startMinutes: hm(15), endMinutes: hm(18), location: "linden", department: "floor", raw: "3-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_addy_giesler", date: "2026-10-08", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_naliyah_bennick", date: "2026-10-08", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_calvin_rittle", date: "2026-10-08", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_kourtney_cantrel", date: "2026-10-08", startMinutes: hm(19), endMinutes: hm(22), location: "linden", department: "floor", raw: "7-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_tyson_langensiepen", date: "2026-10-08", startMinutes: hm(15), endMinutes: hm(18), location: "linden", department: "floor", raw: "3-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_aja_saez", date: "2026-10-08", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_emily_braido", date: "2026-10-08", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },

  // Friday 10/9
  { employeeId: "emp_marietta_zweifel", date: "2026-10-09", startMinutes: hm(9), endMinutes: hm(13), location: "linden", department: "floor", raw: "9-1", source: "oct5_11_2026_paper" },
  { employeeId: "emp_clausnitzer", date: "2026-10-09", startMinutes: hm(12), endMinutes: hm(17), location: "lehigh", department: "floor", raw: "12-5L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_jenn_stone", date: "2026-10-09", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_josh_roman", date: "2026-10-09", startMinutes: hm(19), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "7-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_brady_dosedlo", date: "2026-10-09", startMinutes: hm(11), endMinutes: hm(17), location: "linden", department: "floor", raw: "11-5", source: "oct5_11_2026_paper" },
  { employeeId: "emp_tom_deangelis", date: "2026-10-09", startMinutes: hm(13), endMinutes: hm(17), location: "linden", department: "floor", raw: "1-5", source: "oct5_11_2026_paper" },
  { employeeId: "emp_brady_dologite", date: "2026-10-09", startMinutes: hm(17), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "5-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_braelyn_roth", date: "2026-10-09", startMinutes: hm(17), endMinutes: hm(22), location: "linden", department: "floor", raw: "5-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_calvin_rittle", date: "2026-10-09", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_noah_miller", date: "2026-10-09", startMinutes: hm(17), endMinutes: hm(22), location: "linden", department: "floor", raw: "5-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_kourtney_cantrel", date: "2026-10-09", startMinutes: hm(19), endMinutes: hm(22), location: "linden", department: "floor", raw: "7-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_tyson_langensiepen", date: "2026-10-09", startMinutes: hm(19), endMinutes: hm(22), location: "linden", department: "floor", raw: "7-10", source: "oct5_11_2026_paper" },

  // Saturday 10/10
  { employeeId: "emp_mike_wagner", date: "2026-10-10", startMinutes: hm(9), endMinutes: hm(13), location: "linden", department: "floor", raw: "9-1", source: "oct5_11_2026_paper", notes: "Manual historical — Mike still auto-excluded" },
  { employeeId: "emp_dante_smith", date: "2026-10-10", startMinutes: hm(12), endMinutes: hm(18), location: "linden", department: "floor", raw: "12-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_brady_dologite", date: "2026-10-10", startMinutes: hm(13), endMinutes: hm(18), location: "lehigh", department: "floor", raw: "1-6L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_lucas_cramer", date: "2026-10-10", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_braelyn_roth", date: "2026-10-10", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_addy_giesler", date: "2026-10-10", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_alex_cheatham", date: "2026-10-10", startMinutes: hm(15), endMinutes: hm(22), location: "linden", department: "floor", raw: "3-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_calvin_rittle", date: "2026-10-10", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_noah_miller", date: "2026-10-10", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_kourtney_cantrel", date: "2026-10-10", startMinutes: hm(13), endMinutes: hm(18), location: "linden", department: "floor", raw: "1-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_tyson_langensiepen", date: "2026-10-10", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_aja_saez", date: "2026-10-10", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },

  // Sunday 10/11
  { employeeId: "emp_jenn_stone", date: "2026-10-11", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_mike_wagner", date: "2026-10-11", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper", notes: "Historical only" },
  { employeeId: "emp_brooke", date: "2026-10-11", startMinutes: hm(9), endMinutes: hm(13), location: "linden", department: "floor", raw: "9-1", source: "oct5_11_2026_paper", notes: "Lexy/Brooke shared row — Brooke Sunday opening" },
  { employeeId: "emp_dante_smith", date: "2026-10-11", startMinutes: hm(12), endMinutes: hm(18), location: "linden", department: "floor", raw: "12-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_tom_deangelis", date: "2026-10-11", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_brady_dologite", date: "2026-10-11", startMinutes: hm(13), endMinutes: hm(18), location: "lehigh", department: "floor", raw: "1-6L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_marques_enriquez", date: "2026-10-11", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_lucas_cramer", date: "2026-10-11", startMinutes: hm(15), endMinutes: hm(18), location: "linden", department: "floor", raw: "3-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_braelyn_roth", date: "2026-10-11", startMinutes: hm(13), endMinutes: hm(18), location: "linden", department: "floor", raw: "1-6", source: "oct5_11_2026_paper" },
  { employeeId: "emp_addy_giesler", date: "2026-10-11", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
  { employeeId: "emp_calvin_rittle", date: "2026-10-11", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_noah_miller", date: "2026-10-11", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_alexis_horvath", date: "2026-10-11", startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", department: "floor", raw: "6-10L", source: "oct5_11_2026_paper" },
  { employeeId: "emp_tyson_langensiepen", date: "2026-10-11", startMinutes: hm(18), endMinutes: hm(22), location: "linden", department: "floor", raw: "6-10", source: "oct5_11_2026_paper" },
];

export const OCT_5_11_UNCERTAIN = [
  {
    employeePrinted: "F. Makary",
    dates: ["2026-10-06", "2026-10-08"],
    note: "Faint pencil only on photo — not imported as confirmed assignment",
  },
  {
    employeePrinted: "N. Miller",
    date: "2026-10-08",
    note: "7–10 cell has overwrite/scribble — omitted from confirmed history",
  },
] as const;

/**
 * Merge Oct 5–11 paper into DNA as pattern evidence (idempotent).
 * Does not create availability cells or mandatory weekly assignments.
 */
export function applyOct5PatternEvidence(employees: Employee[]): void {
  const byEmp = new Map<string, HistoricalShiftEvidence[]>();
  for (const row of OCT_5_11_2026_HISTORY) {
    if (row.uncertain) continue;
    if (row.department === "ic") continue;
    if (row.startMinutes <= 0 && row.endMinutes <= 0) continue;
    const list = byEmp.get(row.employeeId) ?? [];
    list.push(row);
    byEmp.set(row.employeeId, list);
  }

  for (const emp of employees) {
    const rows = byEmp.get(emp.id);
    if (!rows?.length) continue;
    emp.dna.commonShiftTypes = emp.dna.commonShiftTypes ?? [];
    emp.dna.lehighEvidenceNotes = emp.dna.lehighEvidenceNotes ?? [];
    emp.dna.weekdayObservations = emp.dna.weekdayObservations ?? [];

    const marker = "oct5_11_2026_paper";
    for (const row of rows) {
      const day = dayOfWeekFromDate(row.date);
      const noteTag = `${marker}:${row.date}:${row.raw}`;

      if (row.location === "lehigh") {
        if (!emp.dna.lehighEvidenceNotes.some((n) => n.includes(noteTag))) {
          emp.dna.lehighEvidenceNotes.push(
            `Oct 5–11 paper ${row.date} ${row.raw} (${noteTag}) — pattern evidence, not confirmed availability.`
          );
        }
      }

      const hasType = emp.dna.commonShiftTypes.some(
        (st) =>
          st.location === row.location &&
          st.startMinutes === row.startMinutes &&
          st.endMinutes === row.endMinutes &&
          (st.dayHints ?? []).includes(day as DayOfWeek) &&
          (st.notes ?? "").includes(marker)
      );
      if (!hasType) {
        emp.dna.commonShiftTypes.push({
          startMinutes: row.startMinutes,
          endMinutes: row.endMinutes,
          location: row.location,
          dayHints: [day],
          weeksObserved: 1,
          notes: `Pattern from ${marker} ${row.raw}${row.notes ? ` — ${row.notes}` : ""}`,
        });
      }
    }
  }
}
