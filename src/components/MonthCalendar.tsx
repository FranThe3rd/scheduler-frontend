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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toneLabel, type AvailabilityTone } from "@/components/availabilityTone";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthCalendar({
  month,
  onMonth,
  selectedDate,
  weekStart,
  marks,
  onSelectDate,
  minDate,
}: {
  month: Date;
  onMonth: (next: Date) => void;
  selectedDate?: string | null;
  weekStart?: string | null;
  marks?: Record<string, AvailabilityTone>;
  onSelectDate: (date: string) => void;
  /** Kept so existing callers compile; the calendar uses one card size. */
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
  const visibleWeek = weekDates.filter((iso) => isSameMonth(parseISO(iso), month));
  const bandStart = visibleWeek[0] ?? null;
  const bandEnd = visibleWeek[visibleWeek.length - 1] ?? null;
  const canGoPrev = !minDate || format(endOfMonth(addMonths(month, -1)), "yyyy-MM-dd") >= minDate;

  return (
    <section className="card p-4 shadow-none sm:p-5" aria-label="Calendar">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[1.65rem] leading-none">{format(month, "MMMM yyyy")}</h2>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--chrome)] hover:bg-[var(--surface-2)] disabled:opacity-30"
            aria-label="Previous month"
            disabled={!canGoPrev}
            onClick={() => onMonth(addMonths(month, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--chrome)] hover:bg-[var(--surface-2)]"
            aria-label="Next month"
            onClick={() => onMonth(addMonths(month, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1.5">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, month);
          const tone = marks?.[iso] ?? "unset";
          const inWeek = inMonth && weekSet.has(iso);
          const selected = selectedDate === iso;
          const past = !!minDate && iso < minDate;
          const start = iso === bandStart;
          const end = iso === bandEnd;
          const bandShadow = inWeek
            ? start && end
              ? "shadow-[inset_0_0_0_1.5px_#3c2918]"
              : start
                ? "shadow-[inset_1.5px_0_0_#3c2918,inset_0_1.5px_0_#3c2918,inset_0_-1.5px_0_#3c2918]"
                : end
                  ? "shadow-[inset_-1.5px_0_0_#3c2918,inset_0_1.5px_0_#3c2918,inset_0_-1.5px_0_#3c2918]"
                  : "shadow-[inset_0_1.5px_0_#3c2918,inset_0_-1.5px_0_#3c2918]"
            : "";
          return (
            <button
              key={iso}
              type="button"
              disabled={!inMonth || past}
              aria-pressed={selected || inWeek}
              aria-label={`${format(day, "EEEE, MMMM d")}, ${toneLabel(tone)}`}
              onClick={() => onSelectDate(iso)}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 py-1 ${inMonth ? "" : "invisible"} ${past ? "opacity-35" : ""} ${
                inWeek ? `bg-white ${bandShadow}` : ""
              } ${start ? "rounded-l-full" : ""} ${end ? "rounded-r-full" : ""}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  selected ? "bg-[var(--chrome)] text-white" : "text-[var(--text)]"
                }`}
              >
                {format(day, "d")}
              </span>
              <span
                className={`day-dot ${tone !== "unset" && inMonth ? `day-dot--${tone}` : ""}`}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
