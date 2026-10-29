import type { Department, Shift } from "./types";
import { minutesToLabel } from "./time";

/**
 * Exact start–end shift palette — clearly distinct color families with dark text.
 * Same interval ⇒ same color across schedule, editor presets, and print.
 * Coverage bar colors stay separate (green / amber / red).
 */
const INTERVAL_COLORS: Record<string, string> = {
  "540-780": "#B8D4F0", // 9–1 blue
  "660-900": "#9ED9C5", // 11–3 teal
  "720-900": "#F5E07A", // 12–3 yellow
  "720-960": "#C9B6F0", // 12–4 purple
  "720-1080": "#F0B27A", // 12–6 orange
  "780-1080": "#F5A3B5", // 1–6 rose
  "900-1080": "#A8D08D", // 3–6 green
  "900-1320": "#8EC8E8", // 3–10 sky
  "960-1320": "#7EB8D4", // 4–10 steel blue
  "1020-1140": "#D4E157", // 5–7 lime
  "1080-1320": "#CE93D8", // 6–10 orchid
  "1140-1320": "#F48FB1", // 7–10 pink
};

/** Stable distinct fallbacks for uncommon custom intervals */
const CUSTOM_PALETTE = [
  "#90CAF9", // blue
  "#80CBC4", // teal
  "#CE93D8", // purple
  "#FFF59D", // yellow
  "#FFCC80", // orange
  "#F48FB1", // rose
  "#A5D6A7", // green
  "#B0BEC5", // gray
  "#81D4FA", // light blue
  "#FFAB91", // coral
] as const;

export function shiftIntervalKey(
  startMinutes: number | null | undefined,
  endMinutes: number | null | undefined
): string | null {
  if (startMinutes == null || endMinutes == null) return null;
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return null;
  return `${startMinutes}-${endMinutes}`;
}

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** Background for a shift card / print chip — keyed by exact start AND end. */
export function shiftCardBackground(
  shift: Pick<Shift, "startMinutes" | "endMinutes" | "department">
): string {
  const key = shiftIntervalKey(shift.startMinutes, shift.endMinutes);
  if (!key) return "#EEF1F4";
  if (INTERVAL_COLORS[key]) return INTERVAL_COLORS[key]!;
  return CUSTOM_PALETTE[hashKey(key) % CUSTOM_PALETTE.length]!;
}

export function shiftIntervalLabel(
  startMinutes: number | null | undefined,
  endMinutes: number | null | undefined
): string {
  if (startMinutes == null || endMinutes == null) return "?";
  return `${minutesToLabel(startMinutes)}–${minutesToLabel(endMinutes)}`;
}

/** Compact legend entries for known intervals present in the week (plus commons). */
export function shiftColorLegendEntries(
  shifts: Array<Pick<Shift, "startMinutes" | "endMinutes">>
): Array<{ key: string; label: string; color: string }> {
  const keys = new Set<string>();
  for (const s of shifts) {
    const k = shiftIntervalKey(s.startMinutes, s.endMinutes);
    if (k) keys.add(k);
  }

  const out: Array<{ key: string; label: string; color: string }> = [];
  for (const key of [...keys].sort((a, b) => {
    const [as, ae] = a.split("-").map(Number);
    const [bs, be] = b.split("-").map(Number);
    return (as ?? 0) - (bs ?? 0) || (ae ?? 0) - (be ?? 0);
  })) {
    const [s, e] = key.split("-").map(Number);
    out.push({
      key,
      label: shiftIntervalLabel(s, e),
      color: INTERVAL_COLORS[key] ?? CUSTOM_PALETTE[hashKey(key) % CUSTOM_PALETTE.length]!,
    });
  }
  return out;
}

/** @deprecated — department no longer recolors the card; kept for call-site compat */
export function shiftDepartmentTint(_dept: Department | undefined): string {
  return "transparent";
}
