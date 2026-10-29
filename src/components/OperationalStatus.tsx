"use client";

import type { WeekSchedule } from "@/lib/types";
import {
  computeBuildEligibility,
  type StaffingStatusProp,
} from "@/lib/buildEligibility";

export function OperationalStatus({
  week,
  staffingStatus,
  confirmedTargetCount,
  hasPendingExtraction,
  unresolvedExtractionCount,
  baselineApproved,
  saveError,
  photoError,
}: {
  week: WeekSchedule;
  staffingStatus?: StaffingStatusProp | null;
  confirmedTargetCount: number;
  hasPendingExtraction?: boolean;
  unresolvedExtractionCount?: number;
  baselineApproved?: boolean;
  saveError?: string | null;
  photoError?: string | null;
}) {
  const hard = week.issues.filter((i) => i.severity === "hard").length;
  const shortages = week.issues.filter((i) => i.severity === "shortage").length;
  const avail = week.issues.filter((i) => i.code === "unconfirmed_availability").length;
  const loc = week.issues.filter((i) => i.code === "unknown_location").length;

  const eligibility = computeBuildEligibility({
    week,
    staffingStatus,
    hasPendingExtraction: Boolean(hasPendingExtraction),
    unresolvedExtractionCount: unresolvedExtractionCount ?? 0,
    baselineApproved:
      baselineApproved || Boolean(staffingStatus?.bothConfirmed) || confirmedTargetCount > 0,
  });

  const messages: Array<{ tone: "info" | "warn" | "conflict" | "ok"; text: string }> = [];

  if (photoError) {
    messages.push({ tone: "warn", text: photoError });
  }

  if (saveError) {
    messages.push({ tone: "conflict", text: `Saving failed: ${saveError}` });
  }

  for (const b of eligibility.blockers) {
    messages.push({ tone: "warn", text: b });
  }

  if (shortages > 0) {
    messages.push({
      tone: "warn",
      text: `${shortages} coverage gap${shortages === 1 ? "" : "s"}.`,
    });
  }

  if (hard > 0) {
    messages.push({
      tone: "conflict",
      text: `${hard} hard conflict${hard === 1 ? "" : "s"}.`,
    });
  }

  if (avail > 0) {
    messages.push({
      tone: "warn",
      text: `${avail} assignment${avail === 1 ? "" : "s"} need availability checked.`,
    });
  }

  if (loc > 0) {
    messages.push({
      tone: "warn",
      text: `${loc} unknown location${loc === 1 ? "" : "s"}.`,
    });
  }

  if (eligibility.canBuild && week.shifts.length === 0 && !hasPendingExtraction) {
    messages.push({ tone: "ok", text: "Ready to build." });
  }

  if (
    week.shifts.length > 0 &&
    hard === 0 &&
    week.status !== "approved" &&
    week.buildMeta?.mode !== "preview_patterns"
  ) {
    messages.push({ tone: "ok", text: "Draft ready — edit, check coverage, print." });
  }

  if (week.status === "approved") {
    messages.push({ tone: "ok", text: "Schedule approved." });
  }

  if (messages.length === 0) return null;

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap gap-2">
      {messages.map((m, i) => (
        <span
          key={`${m.tone}-${i}-${m.text.slice(0, 48)}`}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            m.tone === "conflict"
              ? "bg-[var(--pink-off)] text-[var(--conflict)]"
              : m.tone === "warn"
                ? "bg-[var(--warn-bg)] text-[#8a4b2a] border border-[var(--warn-border)]"
                : m.tone === "ok"
                  ? "bg-white text-[var(--navy)] border border-[var(--border)]"
                  : "bg-white text-[var(--muted)] border border-[var(--border)]"
          }`}
        >
          {m.text}
        </span>
      ))}
    </div>
  );
}
