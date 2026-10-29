"use client";

import type { CoverageIntervalResult, Employee, WeekSchedule } from "@/lib/types";
import { dayOfWeekFromDate, minutesToLabel, weekDates } from "@/lib/time";
import { useMemo, useState } from "react";

function locTitle(loc: string) {
  if (loc === "lehigh") return "Lehi";
  if (loc === "linden") return "Main";
  return "Location?";
}

type Tone = "ok" | "amber" | "short" | "missing";

function toneFor(c: CoverageIntervalResult): Tone {
  if (c.status === "staffing_target_missing") return "missing";
  if (c.status === "unstaffed_open" || c.status === "below_minimum") return "short";
  if (c.status === "minimum_met" && c.desired > c.minimum && c.count < c.desired) {
    return "amber";
  }
  if (c.count < c.minimum) return "short";
  if (c.desired > c.minimum && c.count < c.desired) return "amber";
  return "ok";
}

/** Slim bar colors — light green when met (not dark forest bars). */
function barColor(tone: Tone): string {
  if (tone === "ok") return "#6fbf8a";
  if (tone === "amber") return "#e0a04a";
  if (tone === "missing") return "#c4a35a";
  return "#d45a5a";
}

function statusColor(tone: Tone): string {
  if (tone === "ok") return "#2f6b4f";
  if (tone === "amber") return "#9a6a20";
  if (tone === "missing") return "#8a6a20";
  return "#8a3b45";
}

function statusWord(c: CoverageIntervalResult, tone: Tone): string {
  if (c.status === "staffing_target_missing") return "Staffing target missing";
  if (c.status === "unstaffed_open") return "Unstaffed opening hours";
  if (tone === "ok") return "Met";
  if (tone === "amber") return "Below target";
  return "Short";
}

function needsAttention(c: CoverageIntervalResult): boolean {
  return (
    c.status === "below_minimum" ||
    c.status === "unstaffed_open" ||
    c.status === "staffing_target_missing"
  );
}

/**
 * Compact Mon–Sun coverage cards spanning full opening hours.
 * Counts are concurrent floor staff; green only when required coverage is met
 * without hard eligibility conflicts.
 */
export function DailyCoverageRecap({
  week,
}: {
  week: WeekSchedule;
  employees: Employee[];
}) {
  const dates = weekDates(week.weekStart);
  const rows = week.coverage.filter((c) => c.status !== "no_target");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const hardCount = week.issues.filter((i) => i.severity === "hard").length;
  const shortDays = useMemo(() => {
    const set = new Set<string>();
    for (const c of rows) {
      if (needsAttention(c)) set.add(c.date);
    }
    return set.size;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white/80 p-4">
        <h3 className="font-bold">Daily coverage</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          No confirmed staffing targets — approve the baseline in Settings.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-bold">Daily coverage</h3>
          <p className="text-sm text-[var(--muted)]">
            {shortDays === 0 && hardCount === 0
              ? "All required opening-hours minimums met."
              : `${shortDays} day${shortDays === 1 ? "" : "s"} need attention${
                  hardCount ? ` · ${hardCount} hard conflict${hardCount === 1 ? "" : "s"}` : ""
                }`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost !min-h-9 text-xs"
          onClick={() => setDetailsOpen((v) => !v)}
        >
          {detailsOpen ? "Hide details" : "Show details"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {dates.map((date) => {
          const dayRows = rows
            .filter((c) => c.date === date)
            .sort(
              (a, b) =>
                (a.location === "lehigh" ? 0 : 1) - (b.location === "lehigh" ? 0 : 1) ||
                a.startMinutes - b.startMinutes
            );
          const byLoc = {
            lehigh: dayRows.filter((c) => c.location === "lehigh"),
            linden: dayRows.filter((c) => c.location === "linden"),
          };
          return (
            <article
              key={date}
              className="rounded-2xl border border-[var(--border)] bg-white/90 p-3 shadow-sm"
            >
              <header className="mb-2">
                <div className="text-sm font-bold capitalize text-[var(--text)]">
                  {dayOfWeekFromDate(date)}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {date.slice(5).replace("-", "/")}
                </div>
              </header>
              {(["lehigh", "linden"] as const).map((loc) => {
                const list = byLoc[loc];
                if (list.length === 0) return null;
                const distinctPeople =
                  loc === "lehigh"
                    ? new Set(
                        week.shifts
                          .filter(
                            (s) =>
                              s.date === date &&
                              s.location === "lehigh" &&
                              s.department === "floor" &&
                              s.employeeId
                          )
                          .map((s) => s.employeeId!)
                      ).size
                    : null;
                return (
                  <div key={loc} className="mb-3 last:mb-0">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                        {locTitle(loc)}
                      </span>
                      {distinctPeople != null ? (
                        <span
                          className="text-[10px] font-semibold tabular-nums"
                          style={{
                            color:
                              distinctPeople > 3
                                ? "#8a3b45"
                                : distinctPeople >= 2
                                  ? "#2f6b4f"
                                  : "var(--muted)",
                          }}
                          title="Distinct employees assigned to Lehi today (cap 3 for automatic generation) — separate from concurrent staff counts below"
                        >
                          Lehi: {distinctPeople}/3 people
                        </span>
                      ) : null}
                    </div>
                    <ul className="space-y-2">
                      {list.map((c) => {
                        const tone = toneFor(c);
                        const denom = Math.max(c.desired, c.minimum, 1);
                        const pct =
                          c.status === "staffing_target_missing" && c.minimum === 0
                            ? c.count > 0
                              ? 50
                              : 0
                            : Math.min(100, Math.round((c.count / denom) * 100));
                        return (
                          <li key={`${c.location}-${c.startMinutes}-${c.endMinutes}`}>
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                              <span className="font-medium">
                                {minutesToLabel(c.startMinutes)}–{minutesToLabel(c.endMinutes)}
                              </span>
                              <span className="tabular-nums text-[var(--muted)]">
                                {c.count}
                                {c.minimum > 0 ? ` / ${c.minimum} staff` : " staff"}
                                {c.desired > c.minimum ? (
                                  <span className="ml-1 text-[10px]">(want {c.desired})</span>
                                ) : null}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e8eef0]">
                              <div
                                className="h-full rounded-full transition-[width]"
                                style={{ width: `${pct}%`, background: barColor(tone) }}
                              />
                            </div>
                            <div
                              className="mt-0.5 text-[10px] font-semibold"
                              style={{ color: statusColor(tone) }}
                            >
                              {statusWord(c, tone)}
                              {tone === "short" && c.minimum > c.count
                                ? ` · need ${c.minimum - c.count} more`
                                : ""}
                            </div>
                            {detailsOpen && c.unfilledReason ? (
                              <p className="mt-1 text-[11px] text-[var(--muted)]">
                                {c.unfilledReason}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </article>
          );
        })}
      </div>
    </div>
  );
}
