"use client";

import { useState, type FormEvent } from "react";
import type { AvailabilityCell } from "@/lib/types";
import { minutesToLabel } from "@/lib/time";
import { toneForCell, type AvailabilityTone } from "@/components/availabilityTone";

const CHOICES: Array<{ tone: Exclude<AvailabilityTone, "unclear" | "unset">; label: string }> = [
  { tone: "available", label: "Available all day" },
  { tone: "limited", label: "Choose times" },
  { tone: "off", label: "Sign off" },
];

const TIMES = Array.from({ length: (23 - 6) * 2 + 1 }, (_, i) => 6 * 60 + i * 30);

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(value: string): number | null {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function AvailabilityEditor({
  cell,
  saving,
  onSave,
  formId = "availability-day-form",
  submitLabel = "Save day",
}: {
  cell?: AvailabilityCell | null;
  saving: boolean;
  onSave: (cell: AvailabilityCell) => void;
  formId?: string;
  submitLabel?: string;
}) {
  const initial = toneForCell(cell);
  const [tone, setTone] = useState<Exclude<AvailabilityTone, "unclear" | "unset">>(
    initial === "limited" || initial === "off" || initial === "available" ? initial : "available"
  );
  const [start, setStart] = useState(minutesToTime(cell?.window?.startMinutes ?? 13 * 60));
  const [end, setEnd] = useState(minutesToTime(cell?.window?.endMinutes ?? 18 * 60));
  const [error, setError] = useState<string | null>(null);

  function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (tone === "available") {
      onSave({ kind: "open", source: "manual", note: "Available" });
      return;
    }
    if (tone === "off") {
      onSave({ kind: "off", source: "manual", note: "Off" });
      return;
    }
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
      setError("End time needs to be after the start time.");
      return;
    }
    onSave({
      kind: "window",
      source: "manual",
      window: { startMinutes, endMinutes },
      note: `${minutesToLabel(startMinutes)}–${minutesToLabel(endMinutes)}`,
    });
  }

  return (
    <form id={formId} className="space-y-4" onSubmit={save}>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Availability status">
        {CHOICES.map((choice) => (
          <button
            key={choice.tone}
            type="button"
            aria-pressed={tone === choice.tone}
            onClick={() => setTone(choice.tone)}
            className={`min-h-12 rounded-2xl border-2 px-2 text-sm font-semibold ${
              tone === choice.tone
                ? choice.tone === "available"
                  ? "border-[#245033] bg-[#b7d7a8] text-[#245033]"
                  : choice.tone === "limited"
                    ? "border-[#6d5310] bg-[#f3d56a] text-[#6d5310]"
                    : "border-[#8d3d45] bg-[#f4b7b8] text-[#8d3d45]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {tone === "limited" ? (
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="field-label">From</span>
            <select className="input rounded-xl" value={start} onChange={(e) => setStart(e.target.value)}>
              {TIMES.map((mins) => (
                <option key={mins} value={minutesToTime(mins)}>
                  {minutesToLabel(mins)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Until</span>
            <select className="input rounded-xl" value={end} onChange={(e) => setEnd(e.target.value)}>
              {TIMES.map((mins) => (
                <option key={mins} value={minutesToTime(mins)}>
                  {minutesToLabel(mins)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--conflict)]">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary h-12 w-full rounded-full text-base" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
