import type { AvailabilityCell, Shift, WeekAvailability } from "@/lib/types";
import { minutesToLabel } from "@/lib/time";
import { formatShiftCellCompact } from "@/lib/shiftCellText";
import { availabilityAllowsShift } from "@/lib/validation";

export type AvailabilityTone = "available" | "limited" | "off" | "unclear" | "unset";

export function toneForCell(cell?: AvailabilityCell | null): AvailabilityTone {
  if (!cell || cell.kind === "empty") return "unset";
  if (cell.kind === "off") return "off";
  if (cell.kind === "unclear" || cell.needsReview) return "unclear";
  if (cell.kind === "window" || cell.kind === "after" || cell.kind === "until") return "limited";
  if (cell.kind === "open" || cell.kind === "unrestricted") return "available";
  return "unset";
}

export function toneLabel(tone: AvailabilityTone): string {
  if (tone === "available") return "Available";
  if (tone === "limited") return "Limited hours";
  if (tone === "off") return "Sign off";
  if (tone === "unclear") return "Unclear";
  return "Not set";
}

export function toneClass(tone: AvailabilityTone): string {
  if (tone === "available") return "status-available";
  if (tone === "limited") return "status-limited";
  if (tone === "off") return "status-off";
  if (tone === "unclear") return "status-unclear";
  return "status-unset";
}

export function cellDetail(cell?: AvailabilityCell | null): string {
  if (!cell || cell.kind === "empty") return "No sign-off recorded.";
  if (cell.note) return cell.note;
  if (cell.window) {
    return `${minutesToLabel(cell.window.startMinutes)}–${minutesToLabel(cell.window.endMinutes)}`;
  }
  return toneLabel(toneForCell(cell));
}

export function availabilityCellFor(
  availability: WeekAvailability[] | undefined,
  employeeId: string | null,
  date: string
): AvailabilityCell | null {
  if (!availability || !employeeId) return null;
  return availability.find((row) => row.employeeId === employeeId)?.cells[date] ?? null;
}

/** Short text for a grid cell: "Off", a limited window like "1–6", or "" when nothing notable. */
export function availabilityShortLabel(cell: AvailabilityCell | null): string {
  const tone = toneForCell(cell);
  if (!cell) return "";
  if (tone === "off") return "Off";
  if (tone !== "limited") return "";
  if (cell.window) return formatShiftCellCompact(cell.window.startMinutes, cell.window.endMinutes);
  const note = cell.note?.trim();
  if (!note) return "Ltd";
  return note.length > 7 ? `${note.slice(0, 6)}…` : note;
}

/** Why this shift clashes with the person's availability that day, or null when it fits. */
export function shiftAvailabilityConflict(cell: AvailabilityCell | null, shift: Shift): string | null {
  if (!cell) return null;
  if (cell.kind === "off") return "Signed off this day";
  if (shift.startMinutes == null || shift.endMinutes == null) return null;
  const allow = availabilityAllowsShift(cell, shift.startMinutes, shift.endMinutes);
  if (allow.ok || allow.provisional) return null;
  return cell.window
    ? `Only available ${minutesToLabel(cell.window.startMinutes)}–${minutesToLabel(cell.window.endMinutes)}`
    : (allow.reason ?? "Outside availability");
}
