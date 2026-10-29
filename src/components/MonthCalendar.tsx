"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toneLabel, type AvailabilityTone } from "@/components/availabilityTone";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DOT: Record<AvailabilityTone, string> = {
  available: "bg-[#b7d7a8] text-[#245033]",
  limited: "bg-[#f3d56a] text-[#6d5310]",
  off: "bg-[#f4b7b8] text-[#8d3d45]",
  unclear: "bg-[#f3ead2] text-[#6d5310]",
  unset: "bg-transparent text-[var(--text)]",
};

export function MonthCalendar({
  month,
  onMonth,
  selectedDate,
  weekStart,
  marks,
  onSelectDate,
  compact,
  minDate,
}: {
  month: Date;
  onMonth: (next: Date) => void;
  selectedDate?: string | null;
  weekStart?: string | null;
  marks?: Record<string, AvailabilityTone>;
  onSelectDate: (date: string) => void;
  compact?: boolean;
  /** YYYY-MM-DD; earlier days can't be selected. */
  minDate?: string | null;
}) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekDates = weekStart
    ? Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(weekStart), i), "yyyy-MM-dd"))
    : [];
  const weekSet = new Set(weekDates);
  const canGoPrev = !minDate || format(endOfMonth(addMonths(month, -1)), "yyyy-MM-dd") >= minDate;

  return (
    <section aria-label="Calendar">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="px-2 py-1 text-lg disabled:opacity-30" aria-label="Previous month" disabled={!canGoPrev} onClick={() => onMonth(addMonths(month, -1))}>
          ‹
        </button>
        <h2 className={compact ? "text-base" : "text-lg"}>{format(month, "MMMM yyyy")}</h2>
        <button type="button" className="px-2 py-1 text-lg" aria-label="Next month" onClick={() => onMonth(addMonths(month, 1))}>
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-[#b7ab9e]">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {compact ? day.slice(0, 3) : day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, month);
          const tone = marks?.[iso] ?? "unset";
          const inWeek = weekSet.has(iso);
          const weekEdge = weekDates[0] === iso;
          const selected = selectedDate === iso;
          const past = !!minDate && iso < minDate;
          return (
            <button
              key={iso}
              type="button"
              disabled={!inMonth || past}
              aria-pressed={selected}
              aria-label={`${format(day, "EEEE, MMMM d")}, ${toneLabel(tone)}`}
              onClick={() => onSelectDate(iso)}
              className={`flex min-h-11 items-center justify-center py-1 md:min-h-12 ${inMonth ? "" : "invisible"} ${past ? "opacity-35" : ""}`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold md:h-10 md:w-10 ${
                  weekEdge
                    ? "bg-[var(--chrome)] text-white"
                    : inWeek
                      ? "bg-[#f3e7d4] text-[var(--chrome)]"
                      : DOT[tone]
                } ${selected && !weekEdge ? "ring-2 ring-[var(--chrome)]" : ""}`}
              >
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
