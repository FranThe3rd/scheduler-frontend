import type { Shift } from "@/lib/types";

export type ShiftPlaceKind = "ic" | "lehigh" | "linden";

/** Location/role family for schedule cells. Kept separate from availability tones. */
export function shiftPlaceKind(shift: Pick<Shift, "department" | "location">): ShiftPlaceKind {
  if (shift.department === "ic") return "ic";
  if (shift.location === "lehigh") return "lehigh";
  return "linden";
}

export function shiftPlaceLabel(shift: Pick<Shift, "department" | "location" | "startMinutes" | "endMinutes">): string {
  const place = shift.location === "lehigh" ? "Lehigh" : "Linden";
  if (shift.department === "ic" && shift.startMinutes == null && shift.endMinutes == null) return place;
  if (shift.department === "ic") return `IC · ${place}`;
  return place;
}

/** Color for a shift cell: off, Lehigh, ice cream, or main store. */
export function chipStyle(text: string): string {
  if (text === "—" || text === "") return "bg-[#f4b7b8] text-[#8d3d45]";
  if (/\bL\b/.test(text)) return "bg-[#f3d56a] text-[#6d5310]";
  if (/IC/i.test(text)) return "bg-[#d7e4f8] text-[#2c4a73]";
  return "bg-[#b7d7a8] text-[#245033]";
}
