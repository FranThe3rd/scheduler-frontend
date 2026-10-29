import type { DayOfWeek, LocationCode } from "./types";

function hm(h: number, m = 0) {
  return h * 60 + m;
}

/**
 * Authoritative public business opening hours (manager-confirmed from hours photo).
 * Independent of generated shifts, DNA templates, and staffing minimums.
 *
 * Main: Mon–Sun 11 AM–10 PM
 * Lehi: Mon–Fri noon–10 PM; Sat–Sun 1 PM–10 PM
 *
 * Main 9 AM starts may be legitimate prep outside public hours — do not delete.
 */
export const BUSINESS_OPENING_HOURS: ReadonlyArray<{
  location: LocationCode;
  days: DayOfWeek[];
  openMinutes: number;
  closeMinutes: number;
  source: string;
}> = [
  {
    location: "linden",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    openMinutes: hm(11),
    closeMinutes: hm(22),
    source: "Manager-confirmed Main hours photo: Mon–Sun 11 AM–10 PM",
  },
  {
    location: "lehigh",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    openMinutes: hm(12),
    closeMinutes: hm(22),
    source: "Manager-confirmed Lehi hours photo: Mon–Fri noon–10 PM",
  },
  {
    location: "lehigh",
    days: ["saturday", "sunday"],
    openMinutes: hm(13),
    closeMinutes: hm(22),
    source: "Manager-confirmed Lehi hours photo: Sat–Sun 1 PM–10 PM",
  },
];

export function openingHoursFor(
  location: LocationCode,
  day: DayOfWeek
): { openMinutes: number; closeMinutes: number; source: string } | null {
  if (location === "unknown") return null;
  const row = BUSINESS_OPENING_HOURS.find(
    (h) => h.location === location && h.days.includes(day)
  );
  if (!row) return null;
  return {
    openMinutes: row.openMinutes,
    closeMinutes: row.closeMinutes,
    source: row.source,
  };
}

/** True when [start, end) overlaps public opening hours for that location/day. */
export function overlapsOpeningHours(
  location: LocationCode,
  day: DayOfWeek,
  startMinutes: number,
  endMinutes: number
): boolean {
  const hours = openingHoursFor(location, day);
  if (!hours) return false;
  return startMinutes < hours.closeMinutes && endMinutes > hours.openMinutes;
}
