"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format } from "date-fns";
import { useState, type ReactNode } from "react";
import { mondayOf, formatWeekRange, thisWeekMondayNy } from "@/lib/time";
import { WeekRangePicker } from "@/components/WeekRangePicker";
import type { ScheduleStatus } from "@/lib/types";

const STATUS_LABEL: Record<ScheduleStatus, { text: string; className: string }> = {
  draft: { text: "Draft · not published", className: "tag-draft" },
  approved: { text: "Approved", className: "tag-published" },
  confirmed_worked: { text: "Confirmed worked", className: "tag-published" },
};

/**
 * Week navigation bar. Actions for the current page go in `children`
 * and are right-aligned.
 */
export function WeekToolbar({
  weekStart,
  onChangeWeek,
  status,
  children,
}: {
  weekStart: string;
  onChangeWeek: (weekStart: string) => void;
  status?: ScheduleStatus;
  children?: ReactNode;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const start = mondayOf(weekStart);
  const weekEnd = format(addDays(start, 6), "yyyy-MM-dd");
  const isThisWeek = weekStart === thisWeekMondayNy();
  const statusInfo = status ? STATUS_LABEL[status] : null;

  return (
    <div className="no-print flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => onChangeWeek(format(addDays(start, -7), "yyyy-MM-dd"))}
          aria-label="Previous week"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="btn btn-ghost max-w-[calc(100vw-8rem)] !min-h-11 !px-3 !text-sm sm:!min-h-9 sm:max-w-none sm:!text-base"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          title="Choose week"
        >
          {formatWeekRange(weekStart)}
          <ChevronDown size={14} className="text-[var(--muted)]" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => onChangeWeek(format(addDays(start, 7), "yyyy-MM-dd"))}
          aria-label="Next week"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={isThisWeek}
          onClick={() => onChangeWeek(thisWeekMondayNy())}
        >
          This week
        </button>
      </div>

      {statusInfo ? <span className={`tag ${statusInfo.className}`}>{statusInfo.text}</span> : null}

      {children ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      ) : null}

      <WeekRangePicker
        open={pickerOpen}
        committedStart={weekStart}
        committedEnd={weekEnd}
        onCancel={() => setPickerOpen(false)}
        onApply={(startDate) => {
          onChangeWeek(startDate);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
