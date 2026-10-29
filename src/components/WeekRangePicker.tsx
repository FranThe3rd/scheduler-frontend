"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
} from "date-fns";
import { useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { inclusiveDaySpan, isValidSevenDayWeek, mondayOf } from "@/lib/time";

type Props = {
  open: boolean;
  committedStart: string;
  committedEnd: string;
  onApply: (weekStart: string, weekEnd: string) => void;
  onCancel: () => void;
};

/**
 * Controlled Monday–Sunday week range picker.
 * Temporary draft dates are separate from committed schedule dates.
 * Does not fetch or save until Apply.
 */
export function WeekRangePicker(props: Props) {
  if (!props.open) return null;
  return <WeekRangePickerDialog key={`${props.committedStart}|${props.committedEnd}`} {...props} />;
}

function WeekRangePickerDialog({
  open,
  committedStart,
  committedEnd,
  onApply,
  onCancel,
}: Props) {
  const titleId = useId();
  const [viewMonth, setViewMonth] = useState(() => parseISO(committedStart));
  const [draftStart, setDraftStart] = useState<string | null>(committedStart);
  const [draftEnd, setDraftEnd] = useState<string | null>(committedEnd);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const days = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const gridStart = addDays(start, -((start.getDay() + 6) % 7)); // Monday-first
    const gridEnd = addDays(end, (7 - ((end.getDay() + 6) % 7) - 1 + 7) % 7);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  function selectDay(iso: string) {
    setError(null);
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(iso);
      setDraftEnd(null);
      return;
    }
    // Second click
    if (iso < draftStart) {
      setDraftStart(iso);
      setDraftEnd(draftStart);
    } else {
      setDraftEnd(iso);
    }
  }

  function apply() {
    if (!draftStart || !draftEnd) {
      setError("Select a start date and an end date.");
      return;
    }
    if (!isValidSevenDayWeek(draftStart, draftEnd)) {
      setError(
        `This weekly view needs exactly 7 days (Monday–Sunday). You selected ${inclusiveDaySpan(draftStart, draftEnd)} day(s). Adjust the range — dates were not changed.`
      );
      return;
    }
    const mondayIso = format(mondayOf(draftStart), "yyyy-MM-dd");
    const sundayIso = format(addDays(parseISO(draftStart), 6), "yyyy-MM-dd");
    if (draftStart !== mondayIso || draftEnd !== sundayIso) {
      setError(
        "Please select Monday through Sunday. Start must be a Monday and end the following Sunday. Your selection was kept — adjust and Apply again."
      );
      return;
    }
    onApply(draftStart, draftEnd);
  }

  function inRange(day: Date): boolean {
    if (!draftStart) return false;
    const iso = format(day, "yyyy-MM-dd");
    const end = draftEnd ?? draftStart;
    const a = draftStart <= end ? draftStart : end;
    const b = draftStart <= end ? end : draftStart;
    return iso >= a && iso <= b;
  }

  function isEdge(day: Date): boolean {
    const iso = format(day, "yyyy-MM-dd");
    return iso === draftStart || iso === draftEnd;
  }

  return (
    <div
      className="week-picker-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        // Outside click only on backdrop — not when interacting with the panel
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="week-picker-panel"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)] bg-[#f4f6f9] px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-[var(--text)]">
            Choose week
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-[var(--muted)]">
            Pick Monday, then Sunday (7 days). Your schedule does not change until Apply.
          </p>
        </div>

        <div className="week-picker-body">
          <div className="grid shrink-0 grid-cols-2 gap-3 text-sm">
            <div className="week-picker-range-box">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Start
              </div>
              <div className="mt-0.5 font-semibold text-[var(--text)]">
                {draftStart ? format(parseISO(draftStart), "EEE, MMM d, yyyy") : "—"}
              </div>
            </div>
            <div className="week-picker-range-box">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                End
              </div>
              <div className="mt-0.5 font-semibold text-[var(--text)]">
                {draftEnd ? format(parseISO(draftEnd), "EEE, MMM d, yyyy") : "—"}
              </div>
            </div>
          </div>

          <div className="week-picker-calendar">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="Previous month"
                onClick={() => setViewMonth((m) => addMonths(m, -1))}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="week-picker-month">{format(viewMonth, "MMMM yyyy")}</div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="Next month"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="week-picker-weekdays grid grid-cols-7 text-center shrink-0">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-1.5">
                  {d}
                </div>
              ))}
            </div>
            <div className="week-picker-grid">
              {days.map((day) => {
                const iso = format(day, "yyyy-MM-dd");
                const outside = !isSameMonth(day, viewMonth);
                const selected = inRange(day);
                const edge = isEdge(day);
                const today = isSameDay(day, new Date());
                const classes = [
                  "week-picker-day tabular-nums motion-reduce:transition-none",
                  outside ? "week-picker-day--outside" : "",
                  selected ? "week-picker-day--in-range" : "",
                  edge ? "week-picker-day--edge" : "",
                  today ? "week-picker-day--today" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button key={iso} type="button" className={classes} onClick={() => selectDay(iso)}>
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-[13px] text-[var(--warn-text)]"
            >
              {error}
            </p>
          )}

          <div className="flex shrink-0 justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
