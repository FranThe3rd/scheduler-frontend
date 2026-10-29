import type { DayOfWeek, StaffingIntervalTarget } from "./types";

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function hm(h: number, m = 0) {
  return h * 60 + m;
}

/**
 * Confirmed Linden floor coverage (manager-supplied for demo).
 * One headcount per interval — minimum equals desired.
 */
export const LINDEN_COVERAGE_BLOCKS: ReadonlyArray<{
  start: number;
  end: number;
  count: number;
  label: string;
}> = [
  { start: hm(12), end: hm(15), count: 2, label: "12–3" },
  { start: hm(12), end: hm(18), count: 3, label: "12–6" },
  { start: hm(15), end: hm(18), count: 2, label: "3–6" },
  { start: hm(17), end: hm(19), count: 2, label: "5–7" },
  { start: hm(18), end: hm(22), count: 4, label: "6–10" },
  { start: hm(19), end: hm(22), count: 1, label: "7–10" },
];

/**
 * Lehigh concurrent staffing (Oct 2026 paper + manager intent).
 *
 * Distinct-person cap (≤3/day) is enforced separately in the generator —
 * these rows are concurrent minimums only. Usually one opener + evening
 * coverage; do not require two daytime openers.
 *
 * Opening hours: Mon–Fri noon–10; Sat–Sun 1–10.
 */
export const LEHIGH_COVERAGE_PROPOSALS: ReadonlyArray<{
  start: number;
  end: number;
  count: number;
  /** When set, desired concurrent can exceed minimum (soft). */
  desired?: number;
  label: string;
  days: DayOfWeek[];
  sources: string[];
}> = [
  {
    start: hm(12),
    end: hm(17),
    count: 1,
    label: "12–5 opener",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    sources: [
      "Oct 5–11 paper: B. Clausnitzer noon–5 L Mon/Wed/Fri",
      "Manager: usually one Lehi opener — not two concurrent daytime staff",
    ],
  },
  {
    start: hm(17),
    end: hm(22),
    count: 1,
    label: "5–10 closer",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    sources: [
      "Oct 5–11 paper: Brady Dol. 5–10 L Wed/Fri; Noah 5–10 L Mon",
      "Covers noon–5 → evening handoff without inventing a separate 4–6 headcount of 2",
    ],
  },
  {
    start: hm(18),
    end: hm(22),
    count: 1,
    desired: 2,
    label: "6–10 evening",
    days: ["monday", "tuesday", "saturday", "sunday"],
    sources: [
      "Oct paper often has a second evening closer (Calvin/Noah/Alexis/Tyson)",
      "Minimum stays 1 — two evening staff are not mandatory every day (see Wed single closer)",
    ],
  },
  {
    start: hm(13),
    end: hm(18),
    count: 1,
    label: "1–6 opener",
    days: ["saturday", "sunday"],
    sources: [
      "Oct 5–11 paper: Brady Dol. 1–6 L Sat/Sun",
      "Manager hours: Sat–Sun Lehi opens 1 PM",
    ],
  },
];

function buildLindenTargets(): StaffingIntervalTarget[] {
  const targets: StaffingIntervalTarget[] = [];
  let n = 0;
  for (const day of DAYS) {
    for (const b of LINDEN_COVERAGE_BLOCKS) {
      n += 1;
      targets.push({
        id: `target_linden_${day}_${b.start}_${b.end}`,
        day,
        location: "linden",
        department: "floor",
        startMinutes: b.start,
        endMinutes: b.end,
        minimum: b.count,
        desired: b.count,
        enabled: false,
        confirmed: false,
        label: `Linden ${b.label} (${b.count})`,
      });
    }
  }
  return targets;
}

function buildLehighProposalTargets(): StaffingIntervalTarget[] {
  const targets: StaffingIntervalTarget[] = [];
  for (const b of LEHIGH_COVERAGE_PROPOSALS) {
    for (const day of b.days) {
      const desired = b.desired ?? b.count;
      targets.push({
        id: `target_lehigh_${day}_${b.start}_${b.end}`,
        day,
        location: "lehigh",
        department: "floor",
        startMinutes: b.start,
        endMinutes: b.end,
        minimum: b.count,
        desired,
        enabled: false,
        confirmed: false,
        label: `Lehigh ${b.label} proposal (${b.count}${desired > b.count ? ` want ${desired}` : ""}) — ${b.sources[0]}`,
      });
    }
  }
  return targets;
}

/**
 * Migrate pre–Oct-2026 Lehi targets that forced two concurrent openers /
 * two mandatory evening staff onto the current one-opener model.
 * Preserves manager-edited counts when they already match the new shape.
 */
export function migrateLehighTargetsToDailyCapModel(
  targets: StaffingIntervalTarget[]
): StaffingIntervalTarget[] {
  const proposalKeys = new Set(
    buildLehighProposalTargets().map(
      (t) => `${t.day}-${t.startMinutes}-${t.endMinutes}`
    )
  );
  const out: StaffingIntervalTarget[] = [];
  for (const t of targets) {
    if (t.location !== "lehigh") {
      out.push(t);
      continue;
    }
    // Drop obsolete dual-opener noon–4 (count 2) — replaced by noon–5 count 1
    if (
      t.startMinutes === hm(12) &&
      t.endMinutes === hm(16) &&
      t.minimum >= 2 &&
      !t.label?.toLowerCase().includes("custom")
    ) {
      continue;
    }
    // Drop old mandatory 6–10 count 2 when a newer 5–10 / 6–10 count-1 exists
    if (
      t.startMinutes === hm(18) &&
      t.endMinutes === hm(22) &&
      t.minimum >= 2 &&
      proposalKeys.has(`${t.day}-${t.startMinutes}-${t.endMinutes}`)
    ) {
      out.push({
        ...t,
        minimum: 1,
        desired: Math.max(t.desired, 2),
        label: (t.label ?? "Lehigh 6–10").replace(/\(2\)/, "(1 want 2)"),
      });
      continue;
    }
    out.push(t);
  }
  return out;
}

export function buildDefaultStaffingTargets(): StaffingIntervalTarget[] {
  return [...buildLindenTargets(), ...buildLehighProposalTargets()];
}

/**
 * Normalize staffing targets without touching weeks/availability.
 * Preserves Linden confirmed/enabled flags and edited headcounts.
 * Replaces unconfirmed Lehigh Linden-copy intervals with evidence-based proposals.
 */
export function ensureStaffingTargets(
  targets: StaffingIntervalTarget[]
): StaffingIntervalTarget[] {
  targets = migrateLehighTargetsToDailyCapModel(targets);
  const lindenIntervals = new Set(
    LINDEN_COVERAGE_BLOCKS.map((b) => `${b.start}-${b.end}`)
  );

  let linden = targets.filter((t) => t.location === "linden");
  if (linden.length === 0) {
    linden = buildLindenTargets();
  } else {
    // Ensure every Linden block/day exists; keep existing counts/confirmed flags
    const byKey = new Map(
      linden.map((t) => [`${t.day}-${t.startMinutes}-${t.endMinutes}`, t])
    );
    const filled: StaffingIntervalTarget[] = [];
    for (const day of DAYS) {
      for (const b of LINDEN_COVERAGE_BLOCKS) {
        const key = `${day}-${b.start}-${b.end}`;
        const existing = byKey.get(key);
        if (existing) {
          filled.push({
            ...existing,
            minimum: existing.desired,
            label: `Linden ${b.label} (${existing.desired})`,
          });
        } else {
          filled.push({
            id: `target_linden_${day}_${b.start}_${b.end}`,
            day,
            location: "linden",
            department: "floor",
            startMinutes: b.start,
            endMinutes: b.end,
            minimum: b.count,
            desired: b.count,
            enabled: false,
            confirmed: false,
            label: `Linden ${b.label} (${b.count})`,
          });
        }
      }
    }
    // Keep any confirmed custom Linden intervals not in the default blocks
    for (const t of linden) {
      const key = `${t.day}-${t.startMinutes}-${t.endMinutes}`;
      if (
        !lindenIntervals.has(`${t.startMinutes}-${t.endMinutes}`) &&
        (t.confirmed || t.enabled)
      ) {
        filled.push(t);
      }
    }
    linden = filled;
  }

  const lehighConfirmed = targets.filter(
    (t) => t.location === "lehigh" && t.confirmed
  );
  const lehighUnconfirmed = targets.filter(
    (t) => t.location === "lehigh" && !t.confirmed
  );

  // Detect accidental Linden-shape copies on Lehigh (same intervals as Linden blocks)
  const lehighIsLindenCopy =
    lehighUnconfirmed.length > 0 &&
    lehighUnconfirmed.every((t) =>
      lindenIntervals.has(`${t.startMinutes}-${t.endMinutes}`)
    );

  let lehigh: StaffingIntervalTarget[];
  if (lehighConfirmed.length > 0) {
    const byKey = new Map(
      lehighConfirmed.map((t) => [`${t.day}-${t.startMinutes}-${t.endMinutes}`, t])
    );
    // Merge evidence-based proposal intervals that were missing when Lehigh was
    // first confirmed (e.g. Monday 12–4 daytime). Preserve existing headcounts.
    const merged: StaffingIntervalTarget[] = [...lehighConfirmed];
    for (const proposal of buildLehighProposalTargets()) {
      const key = `${proposal.day}-${proposal.startMinutes}-${proposal.endMinutes}`;
      if (byKey.has(key)) continue;
      merged.push({
        ...proposal,
        confirmed: true,
        enabled: true,
        label: (proposal.label ?? `Lehigh ${proposal.startMinutes}-${proposal.endMinutes}`).replace(
          "proposal",
          "baseline"
        ),
      });
      byKey.set(key, proposal);
    }
    for (const t of lehighUnconfirmed) {
      const key = `${t.day}-${t.startMinutes}-${t.endMinutes}`;
      if (byKey.has(key)) continue;
      if (lindenIntervals.has(`${t.startMinutes}-${t.endMinutes}`)) continue;
      merged.push(t);
      byKey.set(key, t);
    }
    lehigh = merged;
  } else if (lehighIsLindenCopy || lehighUnconfirmed.length === 0) {
    lehigh = buildLehighProposalTargets();
  } else {
    lehigh = lehighUnconfirmed;
  }

  return [...linden, ...lehigh];
}

/** @deprecated use ensureStaffingTargets */
export function syncStaffingTargetCounts(
  targets: StaffingIntervalTarget[]
): StaffingIntervalTarget[] {
  return ensureStaffingTargets(targets);
}

export function confirmLocationTargets(
  targets: StaffingIntervalTarget[],
  location: "linden" | "lehigh"
): StaffingIntervalTarget[] {
  return ensureStaffingTargets(targets).map((t) => {
    if (t.location !== location) return t;
    return { ...t, confirmed: true, enabled: true };
  });
}

/** Confirm Linden only — does not enable Lehigh. */
export function confirmLindenTargetsOnly(
  targets: StaffingIntervalTarget[]
): StaffingIntervalTarget[] {
  return confirmLocationTargets(targets, "linden");
}

export function confirmLehighTargetsOnly(
  targets: StaffingIntervalTarget[]
): StaffingIntervalTarget[] {
  return confirmLocationTargets(targets, "lehigh");
}

export function staffingConfirmationStatus(targets: StaffingIntervalTarget[]): {
  lindenConfirmed: boolean;
  lehighConfirmed: boolean;
  lindenCount: number;
  lehighCount: number;
  bothConfirmed: boolean;
} {
  const lindenCount = targets.filter(
    (t) => t.location === "linden" && t.confirmed && t.enabled
  ).length;
  const lehighCount = targets.filter(
    (t) => t.location === "lehigh" && t.confirmed && t.enabled
  ).length;
  return {
    lindenConfirmed: lindenCount > 0,
    lehighConfirmed: lehighCount > 0,
    lindenCount,
    lehighCount,
    bothConfirmed: lindenCount > 0 && lehighCount > 0,
  };
}

export function lehighProposalSources(): Array<{
  label: string;
  count: number;
  days: string;
  sources: string[];
}> {
  return LEHIGH_COVERAGE_PROPOSALS.map((b) => ({
    label: b.label,
    count: b.count,
    days: b.days.map((d) => d.slice(0, 3)).join(", "),
    sources: [...b.sources],
  }));
}
