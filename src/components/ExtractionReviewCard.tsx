"use client";

import type { Employee } from "@/lib/types";
import { weekDates } from "@/lib/time";
import { useMemo } from "react";

export type ExtractionRow = {
  id: string;
  rawName: string;
  date?: string;
  weekday?: string;
  note?: string;
  kindHint?: string;
  crossedOut?: boolean;
  matchStatus?: "exact" | "ambiguous" | "unknown" | string;
  employeeIds?: string[];
  matchMessage?: string;
  employeeId?: string | null;
  skip?: boolean;
};

export function ExtractionReviewCard({
  weekStart,
  weekEnd,
  message,
  rows,
  employees,
  applying,
  onChangeRows,
  onApply,
  onDismiss,
  onRematchName,
}: {
  weekStart: string;
  weekEnd: string;
  message: string;
  rows: ExtractionRow[];
  employees: Employee[];
  applying: boolean;
  onChangeRows: (rows: ExtractionRow[]) => void;
  onApply: () => void;
  onDismiss: () => void;
  onRematchName: (index: number, rawName: string) => void;
}) {
  const active = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees]
  );
  const dates = useMemo(() => weekDates(weekStart), [weekStart]);

  const unknown = rows.filter((r) => r.matchStatus === "unknown" && !r.skip).length;
  const ambiguous = rows.filter(
    (r) => r.matchStatus === "ambiguous" && !r.skip && !r.employeeId
  ).length;
  const unclearNotes = rows.filter(
    (r) => !r.skip && (r.crossedOut || r.kindHint === "unclear")
  ).length;
  const ready = rows.filter(
    (r) => !r.skip && Boolean(r.employeeId) && Boolean(r.date)
  ).length;
  const unresolved = unknown + ambiguous;
  const canApplyAndBuild = ready > 0 && unresolved === 0;

  function patch(idx: number, patch: Partial<ExtractionRow>) {
    const next = [...rows];
    next[idx] = { ...rows[idx]!, ...patch };
    onChangeRows(next);
  }

  return (
    <section className="card mx-auto max-w-6xl px-4 py-5 sm:px-5">
      <h2 className="heading-tight text-xl">Review sign-offs</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Only unclear names, dates, or notes need a correction. Clear rows apply as written. This is
        a sign-off calendar — signed-off people cannot work; everyone else stays within their saved
        normal windows.
      </p>
      <p className="mt-2 text-sm text-[var(--text)]">{message}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {ready} ready · {ambiguous} need name choice · {unknown} unknown
        {unclearNotes ? ` · ${unclearNotes} unclear note(s)` : ""}
      </p>

      <div className="table-scroll mt-4 rounded-2xl border border-[var(--border)]">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--icy)] text-left">
              <th className="px-3 py-2">Name read</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Sign-off / note</th>
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">Assign / skip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-t border-[var(--border)] align-top">
                <td className="px-3 py-2">
                  <input
                    className="w-full min-w-[8rem] rounded-xl border border-[var(--border)] px-2 py-2 font-semibold"
                    value={row.rawName}
                    onChange={(e) => patch(idx, { rawName: e.target.value })}
                    onBlur={(e) => onRematchName(idx, e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="w-full rounded-xl border border-[var(--border)] px-2 py-2"
                    value={row.date ?? ""}
                    onChange={(e) =>
                      patch(idx, {
                        date: e.target.value || undefined,
                        skip: e.target.value ? row.skip : true,
                      })
                    }
                  >
                    <option value="">Choose date…</option>
                    {dates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {row.weekday ? (
                    <span className="mt-1 block text-xs capitalize text-[var(--muted)]">
                      read as {row.weekday}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {row.crossedOut ? (
                    <span className="mb-1 inline-block rounded bg-[var(--unclear)] px-1.5 py-0.5 text-xs font-semibold">
                      Crossed out / unclear
                    </span>
                  ) : null}
                  <input
                    className="mt-1 w-full min-w-[8rem] rounded-xl border border-[var(--border)] px-2 py-2"
                    value={row.note ?? ""}
                    placeholder={row.kindHint || "Note"}
                    onChange={(e) => patch(idx, { note: e.target.value })}
                  />
                  <label className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={Boolean(row.crossedOut)}
                      onChange={(e) => patch(idx, { crossedOut: e.target.checked })}
                    />
                    Flag unclear / crossed out
                  </label>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      row.matchStatus === "exact"
                        ? "bg-[var(--icy)] text-[var(--navy)]"
                        : row.matchStatus === "ambiguous"
                          ? "bg-[var(--warn-bg)] text-[#8a4b2a]"
                          : "bg-[var(--pink-off)] text-[var(--conflict)]"
                    }`}
                  >
                    {row.matchStatus ?? "unknown"}
                  </span>
                  {row.matchMessage ? (
                    <div className="mt-1 text-xs text-[var(--muted)]">{row.matchMessage}</div>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <label className="mb-1 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(row.skip)}
                      onChange={(e) => patch(idx, { skip: e.target.checked })}
                    />
                    Skip
                  </label>
                  {!row.skip && (
                    <select
                      className="w-full rounded-xl border border-[var(--border)] px-2 py-2 text-sm"
                      value={row.employeeId ?? ""}
                      onChange={(e) =>
                        patch(idx, {
                          employeeId: e.target.value || null,
                          matchStatus: e.target.value ? "exact" : row.matchStatus,
                        })
                      }
                    >
                      <option value="">Choose employee…</option>
                      {active.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.displayName}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={applying || !canApplyAndBuild}
          onClick={onApply}
        >
          {applying ? "Building schedule…" : "Apply and build schedule"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDismiss}>
          Dismiss extraction
        </button>
      </div>
      {!canApplyAndBuild && (
        <p className="mt-2 text-sm text-[#8a4b2a]">
          {unresolved > 0
            ? `Resolve ${unresolved} unclear name mapping${unresolved === 1 ? "" : "s"} (or skip), then Apply and build.`
            : "Assign at least one clear sign-off row to Apply and build."}
        </p>
      )}
      <p className="mt-2 text-xs text-[var(--muted)]">
        Apply overlays these sign-offs on saved normal windows, then builds Linden and Lehigh
        together. Employee DNA is not changed. No second upload needed.
      </p>
    </section>
  );
}
