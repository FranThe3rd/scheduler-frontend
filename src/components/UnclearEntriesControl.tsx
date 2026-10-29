"use client";

import type { Employee } from "@/lib/types";
import { weekDates } from "@/lib/time";
import { formatCompactEmployeeName } from "@/lib/displayName";
import { formatOcrReviewHeadline } from "@/lib/names";
import { useEffect, useMemo, useRef, useState } from "react";

export type UnclearEntry = {
  id: string;
  rawName: string;
  date?: string;
  note?: string;
  kindHint?: string;
  crossedOut?: boolean;
  matchStatus?: string;
  employeeIds?: string[];
  matchMessage?: string;
  reviewHeadline?: string;
  employeeId?: string | null;
  dismissed?: boolean;
  cropDay?: number;
};

function isUnresolved(e: UnclearEntry): boolean {
  return !e.dismissed && (!e.employeeId || e.matchStatus !== "exact");
}

/**
 * Compact control + dialog for unclear OCR marks only.
 * Confident matches go straight into the blank/X grid.
 * Leads with active-roster possible matches; raw OCR is secondary evidence.
 */
export function UnclearEntriesControl({
  weekStart,
  entries,
  employees,
  onChange,
  onApplyCorrection,
  onDismiss,
  onUndoDismiss,
}: {
  weekStart: string;
  entries: UnclearEntry[];
  employees: Employee[];
  onChange: (entries: UnclearEntry[]) => void;
  onApplyCorrection?: (entry: UnclearEntry) => void | Promise<void>;
  onDismiss?: (entry: UnclearEntry) => void | Promise<void>;
  onUndoDismiss?: (entry: UnclearEntry) => void | Promise<void>;
}) {
  const pending = useMemo(() => entries.filter(isUnresolved), [entries]);
  const recentlyDismissed = useMemo(
    () => entries.filter((e) => e.dismissed).slice(-3),
    [entries]
  );
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; day: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const dates = weekDates(weekStart);
  const active = employees.filter((e) => e.status === "active");
  const seededDefaultsRef = useRef<Set<string>>(new Set());

  // Keep focus on the first unresolved entry when the list changes
  useEffect(() => {
    if (!open) return;
    if (pending.length === 0) {
      setFocusId(null);
      return;
    }
    if (!focusId || !pending.some((e) => e.id === focusId)) {
      setFocusId(pending[0]!.id);
    }
  }, [open, pending, focusId]);

  // Preselect the first suggested active employee when none is chosen yet
  useEffect(() => {
    if (!open || pending.length === 0) return;
    const patches: Array<{ id: string; employeeId: string }> = [];
    for (const e of pending) {
      if (e.employeeId) continue;
      if (seededDefaultsRef.current.has(e.id)) continue;
      const first = (e.employeeIds ?? []).find((id) => active.some((a) => a.id === id));
      if (!first) continue;
      seededDefaultsRef.current.add(e.id);
      patches.push({ id: e.id, employeeId: first });
    }
    if (patches.length === 0) return;
    onChange(
      entries.map((e) => {
        const p = patches.find((x) => x.id === e.id);
        return p ? { ...e, employeeId: p.employeeId } : e;
      })
    );
  }, [open, pending, entries, active, onChange]);

  if (entries.length === 0 && recentlyDismissed.length === 0) return null;

  function patch(id: string, next: Partial<UnclearEntry>) {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...next } : e)));
  }

  function resolveEmployeeId(entry: UnclearEntry): string | null {
    if (entry.employeeId && active.some((a) => a.id === entry.employeeId)) {
      return entry.employeeId;
    }
    const first = (entry.employeeIds ?? []).find((id) => active.some((a) => a.id === id));
    return first ?? null;
  }

  async function apply(entry: UnclearEntry) {
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[entry.id];
      return next;
    });
    const employeeId = resolveEmployeeId(entry);
    const date = entry.date;
    if (!date) {
      setErrorById((prev) => ({ ...prev, [entry.id]: "Choose a date before applying." }));
      return;
    }
    if (!employeeId) {
      setErrorById((prev) => ({
        ...prev,
        [entry.id]: "Choose an active employee before applying.",
      }));
      return;
    }
    if (busyId) return;
    setBusyId(entry.id);
    const resolved: UnclearEntry = {
      ...entry,
      employeeId,
      date,
      matchStatus: "exact",
      dismissed: false,
    };
    try {
      // Pending feedback in UI; persist without re-running OCR
      await onApplyCorrection?.(resolved);
      patch(entry.id, {
        matchStatus: "exact",
        employeeId,
        date,
        dismissed: false,
      });
      // Advance using post-apply list
      const after = entries.map((e) =>
        e.id === entry.id
          ? { ...e, matchStatus: "exact", employeeId, date, dismissed: false }
          : e
      );
      const still = after.filter(isUnresolved);
      if (still.length === 0) {
        setOpen(false);
        setFocusId(null);
      } else {
        setFocusId(still[0]!.id);
      }
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [entry.id]:
          err instanceof Error ? err.message : "Could not save correction. Try again.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(entry: UnclearEntry) {
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[entry.id];
      return next;
    });
    if (busyId) return;
    setBusyId(entry.id);
    try {
      await onDismiss?.(entry);
      patch(entry.id, { dismissed: true, employeeId: null });
      const after = entries.map((e) =>
        e.id === entry.id ? { ...e, dismissed: true, employeeId: null } : e
      );
      const still = after.filter(isUnresolved);
      if (still.length === 0) {
        setOpen(false);
        setFocusId(null);
      } else {
        setFocusId(still[0]!.id);
      }
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [entry.id]:
          err instanceof Error ? err.message : "Could not dismiss. Try again.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function undo(entry: UnclearEntry) {
    setBusyId(entry.id);
    try {
      patch(entry.id, { dismissed: false });
      await onUndoDismiss?.(entry);
    } finally {
      setBusyId(null);
    }
  }

  const focused = pending.find((e) => e.id === focusId) ?? pending[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl px-3">
      {pending.length > 0 ? (
        <button
          type="button"
          className="btn btn-ghost !min-h-9 border border-[var(--warn-border)] bg-[var(--warn-bg)] text-sm text-[#8a4b2a]"
          onClick={() => {
            setOpen(true);
            setFocusId(pending[0]?.id ?? null);
          }}
        >
          Review {pending.length} unclear entr{pending.length === 1 ? "y" : "ies"}
        </button>
      ) : entries.some((e) => !e.dismissed) ? (
        <p className="text-xs text-[var(--forest)]">Unclear entries resolved.</p>
      ) : null}

      {recentlyDismissed.length > 0 && !open ? (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
          {recentlyDismissed.map((e) => (
            <button
              key={`undo_${e.id}`}
              type="button"
              className="underline"
              disabled={busyId === e.id}
              onClick={() => void undo(e)}
            >
              Undo dismiss
            </button>
          ))}
        </div>
      ) : null}

      {open && focused && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div
            className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unclear-dialog-title"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 id="unclear-dialog-title" className="font-bold">
                  Unclear calendar marks
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {pending.length} remaining · confirm who this mark belongs to, or dismiss.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost !min-h-8 !px-2 text-sm"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            {(() => {
              const e = focused;
              const cropDay =
                e.cropDay ??
                (e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
                  ? Number(e.date.slice(-2))
                  : undefined);
              const candidateIds = (e.employeeIds ?? [])
                .filter((id) => active.some((a) => a.id === id))
                .slice(0, 3);
              const resolvedId = resolveEmployeeId(e);
              const headline =
                e.reviewHeadline || formatOcrReviewHeadline(employees, candidateIds);
              const cropSrc = cropDay
                ? `/api/ocr/crop?week=${encodeURIComponent(weekStart)}&day=${cropDay}`
                : null;
              const err = errorById[e.id];
              const canApply = Boolean(resolvedId && e.date);
              return (
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-sm">
                  <div className="text-base font-bold text-[var(--text)]">{headline}</div>
                  {e.rawName?.trim() ? (
                    <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                      Handwriting read as “{e.rawName}”
                      {e.note ? ` · ${e.note}` : ""}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                      Unclear / crossed-out mark
                    </div>
                  )}

                  {cropSrc ? (
                    <button
                      type="button"
                      className="mt-2 block w-full overflow-hidden rounded-lg border border-[var(--border)] bg-white"
                      onClick={() => {
                        setLightbox({ src: cropSrc, day: cropDay! });
                        setZoom(1.4);
                        setPan({ x: 0, y: 0 });
                      }}
                      aria-label="Enlarge evidence crop"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cropSrc}
                        alt={`Crop for mark on day ${cropDay}`}
                        className="mx-auto max-h-36 w-auto"
                      />
                      <span className="block bg-white/90 py-1 text-center text-[10px] text-[var(--muted)]">
                        Tap to enlarge · zoom & pan
                      </span>
                    </button>
                  ) : null}

                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold" htmlFor={`unclear-date-${e.id}`}>
                        Date
                      </label>
                      <select
                        id={`unclear-date-${e.id}`}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2"
                        value={e.date ?? ""}
                        onChange={(ev) =>
                          patch(e.id, { date: ev.target.value || undefined })
                        }
                      >
                        <option value="">Choose date…</option>
                        {dates.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        className="block text-xs font-semibold"
                        htmlFor={`unclear-emp-${e.id}`}
                      >
                        Active employee
                      </label>
                      <select
                        id={`unclear-emp-${e.id}`}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2"
                        value={resolvedId ?? ""}
                        onChange={(ev) =>
                          patch(e.id, {
                            employeeId: ev.target.value || null,
                            // Selection only — Apply persists as exact
                            matchStatus:
                              e.matchStatus === "exact" ? "ambiguous" : e.matchStatus,
                          })
                        }
                      >
                        <option value="">Choose…</option>
                        {active.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {formatCompactEmployeeName(emp)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {candidateIds.length > 0 ? (
                    <div className="mt-2">
                      <div className="text-xs font-semibold">Suggested (active roster)</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {candidateIds.map((id) => {
                          const emp = active.find((a) => a.id === id)!;
                          const selected = resolvedId === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                                selected
                                  ? "border-[var(--forest)] bg-[var(--forest)] text-white"
                                  : "border-[var(--border)] bg-white text-[var(--text)]"
                              }`}
                              onClick={() =>
                                patch(e.id, {
                                  employeeId: id,
                                  // Selection only — Apply persists
                                  matchStatus:
                                    e.matchStatus === "exact" ? "ambiguous" : e.matchStatus,
                                })
                              }
                            >
                              {formatCompactEmployeeName(emp)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {err ? (
                    <p className="mt-2 text-xs font-semibold text-[#8a3b45]" role="alert">
                      {err}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="btn btn-forest flex-1 !min-h-9 text-sm"
                      disabled={!canApply || busyId === e.id}
                      onClick={() => void apply(e)}
                    >
                      {busyId === e.id ? "Saving…" : "Apply correction"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost flex-1 !min-h-9 text-sm"
                      disabled={busyId === e.id}
                      onClick={() => void dismiss(e)}
                    >
                      {busyId === e.id ? "Working…" : "Incorrect entry — dismiss"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    Dismiss discards this extracted mark only. No employee or shift is created.
                  </p>
                </div>
              );
            })()}

            {pending.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pending.map((e, i) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      e.id === focused.id
                        ? "border-[var(--forest)] bg-[var(--forest)] text-white"
                        : "border-[var(--border)] bg-white"
                    }`}
                    onClick={() => setFocusId(e.id)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/80"
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged calendar crop"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-white">
            <span className="text-sm font-semibold">Day {lightbox.day} evidence</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/40 px-2 py-1 text-xs"
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
              >
                Zoom in
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/40 px-2 py-1 text-xs"
                onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
              >
                Zoom out
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/40 px-2 py-1 text-xs"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-black"
                onClick={() => setLightbox(null)}
              >
                Close
              </button>
            </div>
          </div>
          <div
            className="relative flex flex-1 cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing"
            onPointerDown={(ev) => {
              dragRef.current = {
                sx: ev.clientX,
                sy: ev.clientY,
                px: pan.x,
                py: pan.y,
              };
              (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
            }}
            onPointerMove={(ev) => {
              if (!dragRef.current) return;
              setPan({
                x: dragRef.current.px + (ev.clientX - dragRef.current.sx),
                y: dragRef.current.py + (ev.clientY - dragRef.current.sy),
              });
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.src}
              alt={`Enlarged crop day ${lightbox.day}`}
              draggable={false}
              className="max-h-full max-w-full select-none rounded border-2 border-[#f5c542] object-contain shadow-2xl"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            />
          </div>
          <p className="px-3 pb-3 text-center text-[11px] text-white/70">
            Yellow outline marks the review crop (includes neighboring cell context). Drag to pan.
          </p>
        </div>
      )}
    </div>
  );
}
