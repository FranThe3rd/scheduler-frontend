"use client";

import type { AvailabilityCell, Employee, WeekSchedule } from "@/lib/types";
import { weekDates, dayOfWeekFromDate, parseAvailabilityNote, minutesToLabel } from "@/lib/time";
import {
  computeBuildEligibility,
  type StaffingStatusProp,
} from "@/lib/buildEligibility";
import { useMemo, useState } from "react";

export type { StaffingStatusProp } from "@/lib/buildEligibility";

function cellDisplay(cell: AvailabilityCell) {
  if (cell.kind === "off") {
    return { className: "bg-[var(--pink-off)] text-[#8a3b45]", label: "X Off" };
  }
  if (cell.kind === "unclear") {
    return { className: "bg-[var(--unclear)] text-[#6b5a1e]", label: cell.note ?? "Unclear" };
  }
  if (cell.kind === "empty") {
    // Dash = no window recorded — never treat as all-day available
    return {
      className: "bg-white text-[var(--muted)]",
      label: "—",
      sub: "unset",
    };
  }
  if (cell.kind === "open") {
    return { className: "bg-[#eef6f0] text-[var(--forest)]", label: "Open" };
  }
  if (cell.kind === "unrestricted") {
    return { className: "bg-[#eef6f0] text-[var(--forest)]", label: "No limit" };
  }
  if (cell.kind === "window" && cell.window) {
    return {
      className: "bg-[#e8f0fa] text-[#2a4a6b]",
      label:
        cell.note && !cell.note.startsWith("Usual")
          ? cell.note
          : `${minutesToLabel(cell.window.startMinutes)}–${minutesToLabel(cell.window.endMinutes)}`,
    };
  }
  return {
    className: "bg-[#e8f0fa] text-[#2a4a6b]",
    label: cell.note ?? cell.kind,
  };
}

function sourceLabel(source?: AvailabilityCell["source"]) {
  if (source === "photo") return "photo";
  if (source === "recurring") return "recurring";
  if (source === "manual") return "manual";
  return null;
}

export type PatternPreviewRow = {
  employeeId: string;
  displayName: string;
  patterns: Array<{ date: string; start: number; end: number; location: string }>;
};

export function AvailabilityCard({
  week,
  employees,
  onChangeCell,
  onBuild,
  onConfirmRecurring,
  onPreviewPatterns,
  onMarkReviewed,
  building,
  staffingStatus,
  hasPendingExtraction,
  unresolvedExtractionCount,
  baselineApproved,
  patternPreview,
}: {
  week: WeekSchedule;
  employees: Employee[];
  onChangeCell: (employeeId: string, date: string, cell: AvailabilityCell) => Promise<void>;
  onBuild: () => void;
  onConfirmRecurring: () => void;
  onPreviewPatterns: () => void;
  onMarkReviewed: () => void;
  building: boolean;
  staffingStatus: StaffingStatusProp | null;
  hasPendingExtraction?: boolean;
  unresolvedExtractionCount?: number;
  baselineApproved?: boolean;
  patternPreview?: PatternPreviewRow[] | null;
}) {
  const dates = weekDates(week.weekStart);
  const active = employees.filter((e) => e.status === "active");
  const [editing, setEditing] = useState<{ employeeId: string; date: string } | null>(null);
  const [draft, setDraft] = useState("");

  const signedOff = week.availability.reduce(
    (n, row) => n + Object.values(row.cells).filter((c) => c.kind === "off").length,
    0
  );
  const restricted = week.availability.reduce(
    (n, row) =>
      n +
      Object.values(row.cells).filter((c) =>
        ["after", "until", "window"].includes(c.kind)
      ).length,
    0
  );
  const unclear = week.availability.reduce(
    (n, row) => n + Object.values(row.cells).filter((c) => c.kind === "unclear" || c.needsReview).length,
    0
  );

  const eligibility = useMemo(
    () =>
      computeBuildEligibility({
        week,
        staffingStatus,
        hasPendingExtraction: Boolean(hasPendingExtraction),
        unresolvedExtractionCount: unresolvedExtractionCount ?? 0,
        baselineApproved: Boolean(baselineApproved),
      }),
    [week, staffingStatus, hasPendingExtraction, unresolvedExtractionCount, baselineApproved]
  );

  function getCell(employeeId: string, date: string): AvailabilityCell {
    const row = week.availability.find((a) => a.employeeId === employeeId);
    return row?.cells[date] ?? { kind: "empty" };
  }

  async function saveEdit() {
    if (!editing) return;
    const raw = draft.trim();
    let cell: AvailabilityCell;
    if (!raw || raw === "—" || raw.toLowerCase() === "empty" || raw.toLowerCase() === "unset") {
      cell = { kind: "empty" };
    } else if (raw.toLowerCase() === "off" || raw.toLowerCase() === "x") {
      cell = { kind: "off", note: "Off" };
    } else if (raw.toLowerCase() === "open") {
      cell = { kind: "open", note: "Open" };
    } else if (raw.toLowerCase() === "no limit" || raw.toLowerCase() === "unrestricted") {
      cell = { kind: "unrestricted" };
    } else {
      const parsed = parseAvailabilityNote(raw);
      cell = {
        kind: parsed.kind,
        note: parsed.note,
        window: parsed.window,
        needsReview: parsed.kind === "unclear",
      };
    }
    await onChangeCell(editing.employeeId, editing.date, cell);
    setEditing(null);
  }

  return (
    <section className="card mx-auto max-w-6xl px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Check what was read.</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {signedOff} sign-offs · {restricted} time notes · {unclear} need review.
            Dashes mean no window recorded — not all-day available. Labels show photo /
            recurring / manual source.
          </p>
        </div>
      </div>

      <div className="table-scroll mt-4 rounded-xl border border-[var(--border)]">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--bg)]">
              <th className="sticky-col min-w-[160px] px-3 py-3 text-left font-semibold">
                Employee
              </th>
              {dates.map((d) => (
                <th key={d} className="min-w-[88px] px-2 py-3 text-center font-semibold">
                  <div className="capitalize">{dayOfWeekFromDate(d).slice(0, 3)}</div>
                  <div className="text-xs font-normal text-[var(--muted)]">
                    {d.slice(5).replace("-", "/")}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.map((emp) => (
              <tr key={emp.id} className="border-t border-[var(--border)]">
                <td className="sticky-col px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: emp.color }}
                    >
                      {emp.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{emp.displayName}</div>
                      <div className="truncate text-xs text-[var(--muted)]">
                        {emp.printedLabel}
                      </div>
                    </div>
                  </div>
                </td>
                {dates.map((d) => {
                  const cell = getCell(emp.id, d);
                  const disp = cellDisplay(cell);
                  const src = sourceLabel(cell.source);
                  return (
                    <td key={d} className="p-1">
                      <button
                        type="button"
                        className={`flex min-h-[52px] w-full flex-col items-center justify-center rounded-lg px-1 text-center text-xs font-semibold ${disp.className}`}
                        onClick={() => {
                          setEditing({ employeeId: emp.id, date: d });
                          setDraft(
                            cell.kind === "empty"
                              ? ""
                              : cell.kind === "off"
                                ? "Off"
                                : cell.kind === "window" && cell.window
                                  ? `${minutesToLabel(cell.window.startMinutes)}-${minutesToLabel(cell.window.endMinutes)}`
                                  : cell.note ?? cell.kind
                          );
                        }}
                      >
                        <span>{disp.label}</span>
                        {"sub" in disp && disp.sub ? (
                          <span className="mt-0.5 text-[10px] font-medium opacity-70">{disp.sub}</span>
                        ) : src ? (
                          <span className="mt-0.5 text-[10px] font-medium opacity-70">{src}</span>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="card w-full max-w-md p-4">
            <h3 className="font-bold">Edit availability</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Examples: Off, After 3, Until 4, 12–6, Open, or leave blank (unset — not available).
            </p>
            <input
              className="mt-3 w-full rounded-xl border border-[var(--border)] px-3 py-3"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn btn-forest flex-1" onClick={() => void saveEdit()}>
                Save
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <p className="text-sm text-[var(--muted)]">
          Status:{" "}
          <span className="font-semibold text-[var(--text)]">{eligibility.statusLabel}</span>
        </p>
        {hasPendingExtraction ? (
          <p className="text-sm text-[#8a4b2a]">
            Finish the photo review above with <strong>Apply and build schedule</strong>.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost !min-h-11 text-sm"
              disabled={building}
              onClick={onConfirmRecurring}
            >
              Refresh normal windows from baseline
            </button>
            <button
              type="button"
              className="btn btn-terracotta !min-h-11 text-sm"
              disabled={building || !eligibility.canBuild}
              onClick={onBuild}
            >
              {building ? "Building…" : "Build without new photo"}
            </button>
          </div>
        )}
        <p className="text-xs text-[var(--muted)]">
          Dashes mean no normal window for that day — not all-day available. Sign-offs block work.
          Baseline staffing is not re-confirmed every week.
        </p>
      </div>

      {!hasPendingExtraction && !eligibility.canBuild && (
        <p className="mt-2 text-center text-sm text-[#8a4b2a]">
          Still blocked: {eligibility.blockers.join(" · ")}
        </p>
      )}
      <button
        type="button"
        className="btn btn-ghost mt-3 w-full"
        disabled={building}
        onClick={onPreviewPatterns}
      >
        Preview usual patterns
      </button>
      <p className="mt-1 text-center text-xs text-[var(--muted)]">
        Pattern preview lists DNA preferences only — it never becomes the weekly draft.
      </p>

      {patternPreview && patternPreview.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-sm">
          <p className="font-semibold">Usual patterns (not a schedule)</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[var(--muted)]">
            {patternPreview.slice(0, 40).map((row) => (
              <li key={row.employeeId}>
                <span className="font-medium text-[var(--text)]">{row.displayName}</span>
                {": "}
                {row.patterns
                  .slice(0, 4)
                  .map(
                    (p) =>
                      `${p.date.slice(5)} ${minutesToLabel(p.start)}–${minutesToLabel(p.end)} (${p.location})`
                  )
                  .join("; ")}
                {row.patterns.length > 4 ? "…" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
