import type { WeekSchedule } from "@/lib/types";

export type StaffingStatusProp = {
  lindenConfirmed: boolean;
  lehighConfirmed: boolean;
  lindenCount: number;
  lehighCount: number;
  bothConfirmed: boolean;
};

export type BuildEligibility = {
  blockers: string[];
  canBuild: boolean;
  /** True when one-time baseline (staffing + location) still needs Mike's approval */
  needsBaselineSetup: boolean;
  /** Short status line — never claims "ready" while blockers remain */
  statusLabel: string;
};

/**
 * Single source of truth for schedule readiness.
 * Weekly flow: photo review + one-time baseline only.
 * Does not re-require staffing confirmation every week once baselineApprovedAt is set.
 */
export function computeBuildEligibility(args: {
  week: WeekSchedule;
  staffingStatus: StaffingStatusProp | null | undefined;
  hasPendingExtraction: boolean;
  /** Unresolved extraction rows that must be fixed before Apply and build */
  unresolvedExtractionCount?: number;
  baselineApproved?: boolean;
}): BuildEligibility {
  const blockers: string[] = [];
  const baselineApproved =
    args.baselineApproved ||
    Boolean(args.staffingStatus?.bothConfirmed); // legacy: both stores confirmed counts as approved

  const needsBaselineSetup = !baselineApproved;

  if (needsBaselineSetup) {
    blockers.push("Approve one-time staffing baseline (Settings)");
  }
  if (args.hasPendingExtraction) {
    const n = args.unresolvedExtractionCount ?? 0;
    if (n > 0) {
      blockers.push(`Correct ${n} unclear name/date/note${n === 1 ? "" : "s"} in photo review`);
    } else {
      blockers.push('Use “Apply and build schedule” on the photo review');
    }
  }

  const staffingBits: string[] = [];
  if (args.staffingStatus) {
    staffingBits.push(
      baselineApproved
        ? "baseline saved"
        : `Linden ${args.staffingStatus.lindenConfirmed ? "ok" : "needed"} · Lehigh ${args.staffingStatus.lehighConfirmed ? "ok" : "needed"}`
    );
  }

  let statusLabel: string;
  if (blockers.length === 0) {
    statusLabel = ["Ready for schedule", ...staffingBits].join(" · ");
  } else if (args.hasPendingExtraction) {
    statusLabel = [
      args.unresolvedExtractionCount
        ? "Fix unclear photo rows, then Apply and build"
        : "Photo ready — Apply and build schedule",
      ...staffingBits,
    ].join(" · ");
  } else if (needsBaselineSetup) {
    statusLabel = ["One-time baseline setup needed", ...staffingBits].join(" · ");
  } else {
    statusLabel = blockers[0] ?? "Not ready";
  }

  return {
    blockers,
    canBuild: blockers.length === 0,
    needsBaselineSetup,
    statusLabel,
  };
}
