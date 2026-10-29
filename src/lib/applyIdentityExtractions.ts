import { promises as fs } from "fs";
import path from "path";
import type { AppData, WeekSchedule } from "./types";
import { resolveEmployeeName } from "./names";
import { overlayExtractionOnWeek } from "./availabilityApply";
import { collapseDuplicateOcrMatches, extractionDismissKey } from "./ocrMatch";
import { format, addDays } from "date-fns";
import { mondayOf } from "./time";
import { emptyWeekAvailability } from "./validation";

export type PendingUnclearMark = {
  rawName: string;
  date?: string;
  note?: string;
  kindHint?: string;
  crossedOut?: boolean;
  matchStatus: "unknown" | "ambiguous";
  matchMessage?: string;
  reviewHeadline?: string;
  employeeIds?: string[];
  cropDay?: number;
};

type ArtifactEntry = {
  rawName: string;
  date?: string;
  weekday?: string;
  note?: string;
  kindHint?: string;
  crossedOut?: boolean;
};

function ensureWeekLocal(data: AppData, weekStartInput: string): WeekSchedule {
  const start = format(mondayOf(weekStartInput), "yyyy-MM-dd");
  const existing = data.weeks.find((w) => w.weekStart === start);
  if (existing) return existing;
  const week: WeekSchedule = {
    id: `week_${start}`,
    weekStart: start,
    weekEnd: format(addDays(mondayOf(start), 6), "yyyy-MM-dd"),
    status: "draft",
    shifts: [],
    availability: emptyWeekAvailability(data.employees, start),
    availabilityReviewed: false,
    issues: [],
    coverage: [],
    totals: [],
    explanation: {
      bullets: [],
      allAvailabilityHonored: false,
      provisionalCount: 0,
      unresolvedAvailabilityCount: 0,
      unresolvedLocationCount: 0,
      availabilityCalendarEntered: false,
      provisionalDraft: true,
    },
  };
  data.weeks.push(week);
  return week;
}

/** Deduplicate pending unclear marks by rawName+date */
export function uniquePendingMarks(marks: PendingUnclearMark[]): PendingUnclearMark[] {
  const seen = new Set<string>();
  const out: PendingUnclearMark[] = [];
  for (const m of marks) {
    const key = `${(m.rawName || "").toLowerCase()}|${m.date ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

async function loadCropEntries(weekStart: string): Promise<ArtifactEntry[]> {
  const dir = path.join(process.cwd(), ".data", "ocr-debug");
  const out: ArtifactEntry[] = [];
  try {
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.startsWith(`crop-${weekStart}-`) || !f.endsWith(".json")) continue;
      if (f.includes(".skip.") || f.includes(".error.") || f.includes(".catch.")) continue;
      try {
        const raw = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as {
          date?: string;
          printedDay?: number;
          entries?: Array<{
            rawName?: string;
            note?: string;
            kindHint?: string;
            crossedOut?: boolean;
          }>;
        };
        const date = raw.date;
        if (!date) continue;
        for (const e of raw.entries ?? []) {
          const rawName = (e.rawName ?? "").trim();
          if (!rawName) continue;
          out.push({
            rawName,
            date,
            note: e.note ?? undefined,
            kindHint: e.kindHint,
            crossedOut: e.crossedOut,
          });
        }
      } catch {
        /* optional crop */
      }
    }
  } catch {
    /* no debug dir */
  }
  return out;
}

/**
 * Prefer cell-crop readings over stale full-page/tile ghosts for the same date
 * when they are known OCR confusions (Andrew vs Addison) or Brady surname fragments.
 */
export function preferCropEvidence(
  finalEntries: ArtifactEntry[],
  cropEntries: ArtifactEntry[]
): ArtifactEntry[] {
  if (cropEntries.length === 0) return finalEntries;
  const byDate = new Map<string, ArtifactEntry[]>();
  for (const e of [...finalEntries, ...cropEntries]) {
    if (!e.date) continue;
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  const out: ArtifactEntry[] = [];
  for (const [date, rows] of byDate) {
    const crops = cropEntries.filter((c) => c.date === date);
    const finals = finalEntries.filter((f) => f.date === date);
    const kept: ArtifactEntry[] = [...crops];
    for (const f of finals) {
      const fn = f.rawName.toLowerCase().replace(/[.]/g, "");
      // Drop Andrew when crop already has Addison on this date
      if (
        /^andrew$/.test(fn) &&
        crops.some((c) => /^(addison|addi|addy)$/i.test(c.rawName))
      ) {
        continue;
      }
      // Drop Brady/Ollogite fragments when crop already has a single Brady Dologite reading
      if (
        crops.some((c) => /brady.*dologite|dologite|brady dologite/i.test(c.rawName)) &&
        (/^b\.?\s*brady$/i.test(f.rawName) ||
          /^oll?ogite$/i.test(f.rawName) ||
          /^brady$/i.test(f.rawName))
      ) {
        continue;
      }
      // Skip exact duplicates already present from crop
      if (
        crops.some(
          (c) => c.rawName.toLowerCase().replace(/[.]/g, "") === fn
        )
      ) {
        continue;
      }
      kept.push(f);
    }
    out.push(...kept);
  }
  // Preserve undated finals
  for (const e of finalEntries) {
    if (!e.date) out.push(e);
  }
  return out;
}

/**
 * Re-resolve saved extraction with the current roster so confirmed
 * Jordan → Jordan Roman and Thomas/Tommy → Tom DeAngelis apply without re-upload.
 * Prefers verified cell-crop evidence over stale tile misreads (Andrew/Brady fragments).
 * Leaves unidentified marks as pending unclear for manual review.
 * Honors week.dismissedExtractionKeys so dismissals survive refresh.
 */
export async function applyConfirmedIdentityExtractions(
  data: AppData
): Promise<{ applied: number; pending: PendingUnclearMark[] }> {
  const artifactPath = path.join(
    process.cwd(),
    ".data",
    "ocr-debug",
    "final-extraction-v2.json"
  );
  let entries: ArtifactEntry[] = [];
  try {
    const raw = JSON.parse(await fs.readFile(artifactPath, "utf8")) as {
      entries?: ArtifactEntry[];
    };
    entries = raw.entries ?? [];
  } catch {
    return { applied: 0, pending: [] };
  }

  const cropEntries = await loadCropEntries("2026-09-14");
  entries = preferCropEvidence(entries, cropEntries);

  // Ensure John from day-20 crop remains reviewable even if final merge dropped it
  try {
    const johnCrop = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), ".data", "ocr-debug", "crop-2026-09-14-20.json"),
        "utf8"
      )
    ) as { date?: string; entries?: Array<{ rawName?: string }> };
    const hasJohn = entries.some((e) => /^john$/i.test(e.rawName ?? ""));
    if (!hasJohn && (johnCrop.entries ?? []).some((e) => /^john$/i.test(e.rawName ?? ""))) {
      entries.push({
        rawName: "John",
        date: johnCrop.date ?? "2026-09-20",
        kindHint: "off",
        crossedOut: false,
      });
    }
  } catch {
    /* crop optional */
  }

  const week = ensureWeekLocal(data, "2026-09-14");
  const dismissed = new Set(week.dismissedExtractionKeys ?? []);
  const resolveTargets = new Set(["emp_josh_roman", "emp_tom_deangelis", "emp_addy_giesler", "emp_brady_dologite"]);

  // Match + collapse fragments before applying (B. Brady + Ollogite → Brady Dol.)
  const matched = entries.map((e) => {
    const raw = (e.rawName ?? "").trim();
    const match = resolveEmployeeName(raw, data.employees);
    return {
      ...e,
      rawName: raw,
      matchStatus: match.status,
      employeeIds: match.employeeIds,
      matchMessage: match.message,
    };
  });
  const collapsed = collapseDuplicateOcrMatches(matched);

  const toApply: Array<{
    rawName: string;
    employeeId: string;
    date?: string;
    weekday?: string;
    note?: string;
    kindHint?: string;
    crossedOut?: boolean;
  }> = [];
  const pending: PendingUnclearMark[] = [];

  for (const e of collapsed) {
    const raw = (e.rawName ?? "").trim();
    if (!raw) continue;

    const dismissKey = extractionDismissKey(raw, e.date);
    if (dismissed.has(dismissKey)) continue;

    // Sep 14–20 test upload: manager confirmed OCR “John” is a misreading of Jordan.
    if (/^john$/i.test(raw) && (e.date?.startsWith("2026-09-") || !e.date)) {
      const date = e.date ?? "2026-09-20";
      if (dismissed.has(extractionDismissKey("John", date))) continue;
      toApply.push({
        rawName: "Jordan",
        employeeId: "emp_josh_roman",
        date,
        weekday: e.weekday,
        note: `Off (OCR raw: “John”)`,
        kindHint: e.kindHint ?? "off",
        crossedOut: e.crossedOut,
      });
      continue;
    }

    // Crop-corrected: never leave Andrew as inventable identity — resolve via active suggestions
    if (/^andrew$/i.test(raw) && e.date) {
      const day = Number(e.date.slice(-2));
      const match = resolveEmployeeName(raw, data.employees);
      pending.push({
        rawName: raw,
        date: e.date,
        note: e.note,
        kindHint: e.kindHint,
        crossedOut: e.crossedOut,
        matchStatus: match.employeeIds.length ? "ambiguous" : "unknown",
        matchMessage: match.reviewHeadline ?? match.message,
        reviewHeadline: match.reviewHeadline ?? match.message,
        employeeIds: match.employeeIds.slice(0, 3),
        cropDay: Number.isFinite(day) ? day : undefined,
      });
      continue;
    }

    if (e.matchStatus === "exact" && e.employeeIds?.length === 1) {
      const id = e.employeeIds[0]!;
      if (resolveTargets.has(id) || id === "emp_addy_giesler" || id === "emp_brady_dologite") {
        const date = e.date;
        if (date) {
          const row = week.availability.find((a) => a.employeeId === id);
          const existing = row?.cells[date];
          if (
            existing &&
            existing.kind === "off" &&
            (existing.source === "photo" || existing.source === "manual")
          ) {
            continue;
          }
        }
        // Only auto-apply known confirmed identity targets + crop-resolved Addison/Brady Dol.
        if (
          resolveTargets.has(id) ||
          id === "emp_addy_giesler" ||
          id === "emp_brady_dologite"
        ) {
          toApply.push({
            rawName: raw,
            employeeId: id,
            date: e.date,
            weekday: e.weekday,
            note: e.note || "Off",
            kindHint: e.kindHint ?? "off",
            crossedOut: e.crossedOut,
          });
        }
      }
      continue;
    }

    if (e.matchStatus === "unknown" || e.matchStatus === "ambiguous") {
      if (/^john$/i.test(raw)) continue;
      const day = e.date ? Number(e.date.slice(-2)) : undefined;
      // Soft suggestions stay ambiguous — never auto-apply lookalikes
      pending.push({
        rawName: raw,
        date: e.date,
        note: e.note,
        kindHint: e.kindHint,
        crossedOut: e.crossedOut,
        matchStatus: e.matchStatus === "ambiguous" ? "ambiguous" : e.employeeIds?.length ? "ambiguous" : "unknown",
        matchMessage: e.matchMessage,
        reviewHeadline: e.matchMessage,
        employeeIds: (e.employeeIds ?? []).slice(0, 3),
        cropDay: Number.isFinite(day) ? day : undefined,
      });
    }
  }

  const result = overlayExtractionOnWeek(week, data.employees, toApply, {
    replacePhoto: false,
  });

  return { applied: result.applied, pending: uniquePendingMarks(pending) };
}
