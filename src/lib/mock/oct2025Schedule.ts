/**
 * Week of Oct 5–11, 2026 — transcribed schedule (mock demo data).
 * Row order matches the paper schedule exactly (not alphabetical).
 */
import { parseShiftCellText } from "../shiftCellText";
import { parseAvailabilityNote, weekDates, newId } from "../time";
import { revalidateWeek } from "../validation";
import type { AppData, LocationCode, Shift, WeekSchedule } from "../types";
import { ensureWeek } from "../fixtures/appData";

/** Monday Oct 5, 2026 → Sunday Oct 11, 2026 */
export const DEMO_WEEK_START = "2026-10-05";

type Row =
  | { employeeId: string; cells: string[] }
  | { employeeId: null; unresolvedLabel: string; cells: string[] };

/** Mon → Sun cell strings (`—`, `Unclear`, `9-1`, `IC`, `6-10 L`, …). */
export const SCHEDULE_ROWS: Row[] = [
  {
    employeeId: "emp_marietta_zweifel",
    cells: ["9-1", "12-3", "9-1", "12-3", "9-1", "—", "—"],
  },
  {
    employeeId: "emp_makary",
    cells: ["—", "-", "—", "—", "—", "—", "—"],
  },
  {
    employeeId: "emp_clausnitzer",
    cells: ["12-5", "—", "12-5", "—", "12-5", "—", "—"],
  },
  {
    employeeId: "emp_jenn_stone",
    cells: ["6-10", "—", "6-10", "—", "6-10", "—", "6-10"],
  },
  {
    employeeId: "emp_mike_wagner",
    cells: ["IC", "IC", "—", "—", "—", "9-1", "6-10"],
  },
  {
    employeeId: "emp_josh_roman",
    cells: ["—", "—", "—", "—", "7-10", "—", "—"],
  },
  {
    employeeId: "emp_brady_dosedlo",
    cells: ["12-6", "9-3", "12-6", "9-3", "11-5", "—", "—"],
  },
  {
    employeeId: null,
    unresolvedLabel: "Lexy/Brooke",
    cells: ["—", "7-10", "—", "7-10", "—", "—", "9-1"],
  },
  {
    employeeId: "emp_dante_smith",
    cells: ["—", "IC", "—", "12-6 L", "—", "12-6", "12-6"],
  },
  {
    employeeId: "emp_tom_deangelis",
    cells: ["1-6", "7-10", "1-6", "—", "1-5", "—", "6-10"],
  },
  {
    employeeId: "emp_brady_dologite",
    cells: ["—", "—", "5-10 L", "—", "5-10 L", "1-6 L", "1-6 L"],
  },
  {
    employeeId: "emp_marques_enriquez",
    cells: ["—", "3-6", "7-10", "—", "—", "—", "6-10"],
  },
  {
    employeeId: "emp_lucas_cramer",
    cells: ["—", "—", "6-10", "3-6", "—", "6-10", "1-6"],
  },
  {
    employeeId: "emp_braelyn_roth",
    cells: ["—", "—", "—", "—", "5-10", "6-10", "1-6"],
  },
  {
    employeeId: "emp_addy_giesler",
    cells: ["—", "6-10", "—", "6-10", "—", "6-10", "6-10"],
  },
  {
    employeeId: "emp_alex_cheatham",
    cells: ["6-10", "1-6 L", "7-10", "—", "—", "3-10", "—"],
  },
  {
    employeeId: "emp_naliyah_bennick",
    cells: ["6-10", "6-10", "—", "6-10", "—", "—", "—"],
  },
  {
    employeeId: "emp_calvin_rittle",
    cells: ["7-10", "6-10 L", "—", "6-10 L", "6-10", "—", "—"],
  },
  {
    employeeId: "emp_noah_miller",
    cells: ["5-10 L", "3-6", "—", "—", "5-10", "6-10 L", "6-10 L"],
  },
  {
    employeeId: "emp_kourtney_cantrel",
    cells: ["—", "—", "6-10", "7-10", "7-10", "1-6", "—"],
  },
  {
    employeeId: "emp_alexis_horvath",
    cells: ["6-10 L", "—", "—", "—", "—", "—", "6-10 L"],
  },
  {
    employeeId: "emp_tyson_langensiepen",
    cells: ["—", "6-10", "—", "3-6", "7-10", "6-10 L", "6-10"],
  },
  {
    employeeId: "emp_aja_saez",
    cells: ["—", "6-10 L", "—", "6-10 L", "—", "—", "—"],
  },
  {
    employeeId: "emp_emily_braido",
    cells: ["7-10", "—", "—", "6-10", "—", "6-10", "—"],
  },
];

export type RosterLine =
  | { kind: "employee"; employeeId: string }
  | { kind: "unresolved"; label: string };

/** Display order for the weekly grid — same as the paper schedule. */
export const SCHEDULE_ROSTER_ORDER: RosterLine[] = SCHEDULE_ROWS.map((row) => {
  if (row.employeeId !== null) {
    return { kind: "employee", employeeId: row.employeeId };
  }
  return { kind: "unresolved", label: row.unresolvedLabel };
});

/** Default Lehigh when the cell has no explicit L (paper roster convention). */
const LEHIGH_DEFAULT_EMPLOYEES = new Set(["emp_clausnitzer", "emp_makary"]);

function normalizeCell(raw: string): string {
  return raw.trim().replace(/[–—]/g, "-");
}

function isBlank(cell: string): boolean {
  const c = normalizeCell(cell);
  return !c || c === "-";
}

function cellHasExplicitLehigh(cell: string): boolean {
  return /\sL$/i.test(normalizeCell(cell).replace(/\*+$/, "").trim());
}

function shiftFromCell(args: {
  date: string;
  employeeId: string | null;
  unresolvedLabel?: string;
  time: string;
}): Shift | null {
  const raw = args.time;
  const norm = normalizeCell(raw);
  const uncertain = raw.includes("*");

  if (/^IC$/i.test(norm)) {
    return {
      id: newId("shift"),
      employeeId: args.employeeId,
      unresolvedLabel: args.unresolvedLabel,
      date: args.date,
      startMinutes: null,
      endMinutes: null,
      location: "linden",
      department: "ic",
      locked: false,
      source: "history",
      notes: "IC",
    };
  }

  const parsed = parseShiftCellText(raw);
  if (!parsed) {
    const legacy = parseAvailabilityNote(norm.replace(/\*+$/, "").replace(/\s+L$/i, "").replace(/\sIC$/i, ""));
    if (legacy.kind !== "window" || !legacy.window) return null;
    let location: LocationCode = cellHasExplicitLehigh(raw) ? "lehigh" : "linden";
    if (
      location === "linden" &&
      args.employeeId &&
      LEHIGH_DEFAULT_EMPLOYEES.has(args.employeeId)
    ) {
      location = "lehigh";
    }
    return {
      id: newId("shift"),
      employeeId: args.employeeId,
      unresolvedLabel: args.unresolvedLabel,
      date: args.date,
      startMinutes: legacy.window.startMinutes,
      endMinutes: legacy.window.endMinutes,
      location,
      department: "floor",
      locked: false,
      source: "history",
      notes: uncertain ? "Verify — uncertain in photo" : "Transcribed from Oct 5–11, 2026 schedule",
    };
  }

  let location = parsed.location;
  if (
    location === "linden" &&
    !cellHasExplicitLehigh(raw) &&
    args.employeeId &&
    LEHIGH_DEFAULT_EMPLOYEES.has(args.employeeId)
  ) {
    location = "lehigh";
  }

  return {
    id: newId("shift"),
    employeeId: args.employeeId,
    unresolvedLabel: args.unresolvedLabel,
    date: args.date,
    startMinutes: parsed.startMinutes,
    endMinutes: parsed.endMinutes,
    location,
    department: parsed.department,
    locked: false,
    source: "history",
    notes: uncertain
      ? "Verify — uncertain in photo"
      : parsed.department === "ic"
        ? "IC"
        : "Transcribed from Oct 5–11, 2026 schedule",
  };
}

export function buildOct2025DemoWeek(data: AppData): WeekSchedule {
  data.weeks = data.weeks.filter((w) => w.weekStart !== DEMO_WEEK_START);
  const week = ensureWeek(data, DEMO_WEEK_START);
  const dates = weekDates(DEMO_WEEK_START);
  const shifts: Shift[] = [];

  for (const row of SCHEDULE_ROWS) {
    row.cells.forEach((cell, i) => {
      const date = dates[i]!;
      if (isBlank(cell)) return;
      const norm = normalizeCell(cell);
      if (norm.toLowerCase() === "unclear") {
        if (row.employeeId) {
          const avail = week.availability.find((a) => a.employeeId === row.employeeId);
          if (avail) {
            avail.cells[date] = {
              kind: "unclear",
              note: "Unclear in photo — verify",
              needsReview: true,
              source: "manual",
            };
          }
        }
        return;
      }
      const shift = shiftFromCell({
        date,
        employeeId: row.employeeId,
        unresolvedLabel: row.employeeId === null ? row.unresolvedLabel : undefined,
        time: cell,
      });
      if (shift) shifts.push(shift);
    });
  }

  week.shifts = shifts;
  week.status = "draft";
  week.availabilityReviewed = true;
  week.explanation.bullets = [
    "Mock demo: weekly schedule transcribed for Oct 5–11, 2026.",
    "Blank cells are not treated as time off — employees may still be available.",
    "Shifts marked with * in the photo should be verified.",
  ];
  week.explanation.availabilityCalendarEntered = true;
  week.explanation.provisionalDraft = false;

  const v = revalidateWeek({
    shifts: week.shifts,
    availability: week.availability,
    employees: data.employees,
    targets: data.staffingTargets,
    weekStart: week.weekStart,
  });
  week.shifts = v.shifts;
  week.issues = v.issues;
  week.coverage = v.coverage;
  week.totals = v.totals;
  week.explanation = { ...week.explanation, ...v.explanation };

  return week;
}
