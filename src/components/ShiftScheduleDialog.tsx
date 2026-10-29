"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatShiftCellText,
  isIcOnlyPayload,
  parseShiftCellText,
  shiftToCellPayload,
  type ShiftCellPayload,
} from "@/lib/shiftCellText";
import type { Shift } from "@/lib/types";
import { minutesToLabel } from "@/lib/time";

type ShiftPreset = { label: string; start: number; end: number; location: "linden" | "lehigh" };

const h = (hour: number) => hour * 60;

/** The usual main-store blocks. */
export const MAIN_SHIFT_PRESETS: ShiftPreset[] = [
  { label: "9–1", start: h(9), end: h(13), location: "linden" },
  { label: "9–3", start: h(9), end: h(15), location: "linden" },
  { label: "12–3", start: h(12), end: h(15), location: "linden" },
  { label: "12–4", start: h(12), end: h(16), location: "linden" },
  { label: "12–6", start: h(12), end: h(18), location: "linden" },
  { label: "1–6", start: h(13), end: h(18), location: "linden" },
  { label: "3–6", start: h(15), end: h(18), location: "linden" },
  { label: "3–7", start: h(15), end: h(19), location: "linden" },
  { label: "6–10", start: h(18), end: h(22), location: "linden" },
  { label: "7–10", start: h(19), end: h(22), location: "linden" },
];

/** Lehigh is usually 12–5 or 12–6, then 5–10 or 6–10. */
export const LEHIGH_SHIFT_PRESETS: ShiftPreset[] = [
  { label: "12–5", start: h(12), end: h(17), location: "lehigh" },
  { label: "12–6", start: h(12), end: h(18), location: "lehigh" },
  { label: "5–10", start: h(17), end: h(22), location: "lehigh" },
  { label: "6–10", start: h(18), end: h(22), location: "lehigh" },
];

const TIME_OPTIONS = Array.from({ length: (23 - 6) * 2 + 1 }, (_, i) => 6 * 60 + i * 30);

const DEFAULT_TIMES = { startMinutes: 9 * 60, endMinutes: 13 * 60 };

function initialPayload(
  initialText: string,
  existingShift?: Shift | null
): ShiftCellPayload & { includeHours: boolean } {
  if (existingShift) {
    const fromShift = shiftToCellPayload(existingShift);
    if (fromShift) {
      const includeHours = !isIcOnlyPayload(fromShift);
      return { ...fromShift, includeHours };
    }
  }
  const parsed = parseShiftCellText(initialText.trim().replace(/\n/g, " / "));
  if (parsed) {
    const includeHours = !isIcOnlyPayload(parsed);
    return {
      ...parsed,
      startMinutes: parsed.startMinutes ?? DEFAULT_TIMES.startMinutes,
      endMinutes: parsed.endMinutes ?? DEFAULT_TIMES.endMinutes,
      includeHours,
    };
  }
  return {
    startMinutes: DEFAULT_TIMES.startMinutes,
    endMinutes: DEFAULT_TIMES.endMinutes,
    location: "linden",
    department: "floor",
    includeHours: true,
  };
}

export function ShiftScheduleDialog({
  title,
  subtitle,
  initialText,
  existingShift,
  onSave,
  onClose,
}: {
  title: string;
  subtitle?: string;
  initialText: string;
  existingShift?: Shift | null;
  onSave: (shift: ShiftCellPayload | null) => void | Promise<void>;
  onClose: () => void;
}) {
  const parsedInitial = useMemo(
    () => initialPayload(initialText, existingShift),
    [initialText, existingShift]
  );
  const isOff = useMemo(() => {
    const raw = initialText.trim();
    return !raw || raw === "—";
  }, [initialText]);

  const [startMinutes, setStartMinutes] = useState(parsedInitial.startMinutes ?? DEFAULT_TIMES.startMinutes);
  const [endMinutes, setEndMinutes] = useState(parsedInitial.endMinutes ?? DEFAULT_TIMES.endMinutes);
  const [location, setLocation] = useState<ShiftCellPayload["location"]>(parsedInitial.location);
  const [department, setDepartment] = useState<ShiftCellPayload["department"]>(
    parsedInitial.department
  );
  const [includeHours, setIncludeHours] = useState(parsedInitial.includeHours);
  const [saving, setSaving] = useState(false);

  const icOnly = department === "ic" && !includeHours;

  const previewPayload: ShiftCellPayload = icOnly
    ? {
        startMinutes: null,
        endMinutes: null,
        location,
        department: "ic",
        icOnly: true,
        uncertain: parsedInitial.uncertain,
      }
    : {
        startMinutes,
        endMinutes,
        location,
        department,
        uncertain: parsedInitial.uncertain,
      };

  const preview = formatShiftCellText(previewPayload);

  function applyPreset(preset: ShiftPreset) {
    setIncludeHours(true);
    setStartMinutes(preset.start);
    setEndMinutes(preset.end);
    setLocation(preset.location);
  }

  async function deleteSchedule() {
    setSaving(true);
    try {
      await onSave(null);
    } finally {
      setSaving(false);
    }
  }

  const hasExisting =
    Boolean(existingShift) ||
    (initialText.trim() !== "" && initialText.trim() !== "—");

  async function saveCustom() {
    setSaving(true);
    try {
      if (icOnly) {
        await onSave({
          startMinutes: null,
          endMinutes: null,
          location,
          department: "ic",
          icOnly: true,
          uncertain: parsedInitial.uncertain,
        });
      } else {
        await onSave({
          startMinutes,
          endMinutes,
          location,
          department,
          uncertain: parsedInitial.uncertain,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const radioLabel =
    "flex flex-1 cursor-pointer items-center gap-2 border border-[var(--border-strong)] px-3 py-1.5 text-sm rounded-[4px]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overflow-hidden shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-schedule-title"
      >
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
          <h3 id="shift-schedule-title" className="text-[15px] font-semibold">
            {title}
          </h3>
          {subtitle ? <p className="text-xs text-[var(--muted)]">{subtitle}</p> : null}
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-3">
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={department === "ic"}
                onChange={(e) => {
                  const on = e.target.checked;
                  setDepartment(on ? "ic" : "floor");
                  if (on) setIncludeHours(false);
                  else setIncludeHours(true);
                }}
              />
              <span>
                <span className="font-semibold">IC — ice cream</span>
                <span className="block text-xs text-[var(--muted)]">
                  Varies week to week; manager decides who is on IC.
                </span>
              </span>
            </label>

            {department === "ic" ? (
              <label className="ml-6 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={includeHours}
                  onChange={(e) => setIncludeHours(e.target.checked)}
                />
                <span>
                  <span className="font-semibold">Include hours on schedule</span>
                  <span className="block text-xs text-[var(--muted)]">
                    Leave off to save the cell as <strong>IC</strong> only (no time range).
                  </span>
                </span>
              </label>
            ) : null}
          </div>

          {!icOnly ? (
            <>
              {([
                { title: "Main store shifts", presets: MAIN_SHIFT_PRESETS },
                { title: "Lehigh shifts", presets: LEHIGH_SHIFT_PRESETS },
              ] as const).map((group) => (
                <div key={group.title}>
                  <p className="field-label">{group.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.presets.map((p) => {
                      const active =
                        includeHours &&
                        startMinutes === p.start &&
                        endMinutes === p.end &&
                        (location === "lehigh") === (p.location === "lehigh");
                      return (
                        <button
                          key={p.label}
                          type="button"
                          aria-pressed={active}
                          className={`min-w-[3.25rem] rounded-[4px] border px-2 py-1 text-[13px] font-semibold tabular-nums transition-colors ${
                            active
                              ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-dark)]"
                              : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                          }`}
                          onClick={() => applyPreset(p)}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="field-label">Start</span>
                  <select
                    className="input"
                    value={startMinutes}
                    onChange={(e) => {
                      setIncludeHours(true);
                      setStartMinutes(Number(e.target.value));
                    }}
                  >
                    {TIME_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {minutesToLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">End</span>
                  <select
                    className="input"
                    value={endMinutes}
                    onChange={(e) => {
                      setIncludeHours(true);
                      setEndMinutes(Number(e.target.value));
                    }}
                  >
                    {TIME_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {minutesToLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset>
                <legend className="field-label">Store</legend>
                <div className="flex gap-2">
                  <label
                    className={`${radioLabel} ${
                      location !== "lehigh" ? "border-[var(--main-bar)] bg-[var(--main-bg)]" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="shift-location"
                      checked={location !== "lehigh"}
                      onChange={() => setLocation("linden")}
                    />
                    Main store
                  </label>
                  <label
                    className={`${radioLabel} ${
                      location === "lehigh" ? "border-[var(--lehigh-bar)] bg-[var(--lehigh-bg)]" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="shift-location"
                      checked={location === "lehigh"}
                      onChange={() => setLocation("lehigh")}
                    />
                    Lehigh (L)
                  </label>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Lehigh shows as an L after the hours on the paper schedule; no L means main store.
                </p>
              </fieldset>
            </>
          ) : null}

          <div className="flex items-center justify-between border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm">
            <span className="text-[var(--muted)]">Cell will show</span>
            <span className="text-base font-semibold tabular-nums">
              {isOff && !existingShift && department !== "ic" ? "Off" : preview}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
          <button
            type="button"
            className="btn btn-ghost btn-danger"
            disabled={saving || !hasExisting}
            title="Remove everything in this cell for this day (shift times, IC, or Lehigh)."
            onClick={() => void deleteSchedule()}
          >
            {saving ? "Working…" : "Delete schedule"}
          </button>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={() => void saveCustom()}
            >
              {saving ? "Saving…" : "Save shift"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
