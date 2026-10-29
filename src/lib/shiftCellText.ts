import { parseAvailabilityNote } from "./time";
import type { Shift } from "./types";

/** Paper-style display: 9–1, 12–6, 6–10 (no AM/PM). */
export function formatShiftCellCompact(start: number, end: number): string {
  const toHour = (minutes: number) => {
    const h24 = Math.floor(minutes / 60);
    return h24 % 12 === 0 ? 12 : h24 % 12;
  };
  return `${toHour(start)}–${toHour(end)}`;
}

export type ShiftCellPayload = {
  startMinutes: number | null;
  endMinutes: number | null;
  location: Shift["location"];
  department: Shift["department"];
  uncertain?: boolean;
  /** Ice cream with no hours on the sheet — cell shows "IC" only */
  icOnly?: boolean;
};

export function isIcOnlyPayload(payload: ShiftCellPayload): boolean {
  return (
    payload.department === "ic" &&
    (payload.icOnly || payload.startMinutes == null || payload.endMinutes == null)
  );
}

export function formatShiftCellText(payload: ShiftCellPayload): string {
  if (isIcOnlyPayload(payload)) return "IC";
  if (payload.startMinutes == null || payload.endMinutes == null) return "—";
  let text = formatShiftCellCompact(payload.startMinutes, payload.endMinutes);
  if (payload.uncertain) text += "*";
  if (payload.location === "lehigh") text += " L";
  if (payload.department === "ic") text += " IC";
  return text;
}

export function shiftToCellText(shift: Shift): string {
  if (shift.department === "ic" && shift.startMinutes == null && shift.endMinutes == null) {
    return "IC";
  }
  if (shift.startMinutes != null && shift.endMinutes != null) {
    return formatShiftCellText({
      startMinutes: shift.startMinutes,
      endMinutes: shift.endMinutes,
      location: shift.location,
      department: shift.department,
      uncertain: shift.notes?.includes("uncertain"),
    });
  }
  if (shift.notes) return shift.notes;
  return "—";
}

function stripCellSuffixes(raw: string): {
  core: string;
  lehigh: boolean;
  ic: boolean;
  uncertain: boolean;
} {
  let s = raw.trim();
  let uncertain = false;
  if (/\*$/.test(s)) {
    uncertain = true;
    s = s.replace(/\*+$/, "").trim();
  }
  let ic = false;
  if (/\sIC$/i.test(s)) {
    ic = true;
    s = s.replace(/\sIC$/i, "").trim();
  }
  let lehigh = false;
  if (/\sL$/i.test(s)) {
    lehigh = true;
    s = s.replace(/\sL$/i, "").trim();
  }
  return { core: s, lehigh, ic, uncertain };
}

/** Parse cell text into shift times and tags; returns null for empty/off. */
export function parseShiftCellText(raw: string): ShiftCellPayload | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-" || /^off$/i.test(trimmed)) {
    return null;
  }
  if (/^IC$/i.test(trimmed)) {
    return {
      startMinutes: null,
      endMinutes: null,
      location: "linden",
      department: "ic",
      icOnly: true,
    };
  }
  const { core, lehigh, ic, uncertain } = stripCellSuffixes(trimmed);
  if (/^unclear$/i.test(core)) return null;
  const parsed = parseAvailabilityNote(core);
  if (parsed.kind === "window" && parsed.window) {
    return {
      startMinutes: parsed.window.startMinutes,
      endMinutes: parsed.window.endMinutes,
      location: lehigh ? "lehigh" : "linden",
      department: ic ? "ic" : "floor",
      uncertain,
    };
  }
  return null;
}

export function shiftToCellPayload(shift: Shift): ShiftCellPayload | null {
  if (
    shift.department === "ic" &&
    shift.startMinutes == null &&
    shift.endMinutes == null
  ) {
    return {
      startMinutes: null,
      endMinutes: null,
      location: shift.location,
      department: "ic",
      icOnly: true,
    };
  }
  if (shift.startMinutes == null || shift.endMinutes == null) return null;
  return {
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
    location: shift.location,
    department: shift.department,
    uncertain: shift.notes?.includes("uncertain"),
  };
}
