"use client";

import type { DayCellReport } from "@/lib/ocrTypes";
import { dayOfWeekFromDate } from "@/lib/time";

/**
 * Compact seven-day crop strip for final visual check against the photo.
 * Lets Mike spot omissions without opening each review dialog.
 */
export function DaySourceStrip({
  weekStart,
  dayReports,
  photoConfirmed,
  onPhotoConfirmedChange,
}: {
  weekStart: string;
  dayReports: DayCellReport[];
  photoConfirmed: boolean;
  onPhotoConfirmedChange: (v: boolean) => void;
}) {
  if (!dayReports.length) return null;

  function tone(status: DayCellReport["status"]): string {
    switch (status) {
      case "has_marks":
        return "border-emerald-600/40 bg-emerald-50";
      case "verified_empty":
        return "border-[var(--border)] bg-[var(--bg)]";
      case "has_unreadable":
      case "date_uncertain":
        return "border-amber-600/50 bg-amber-50";
      case "extraction_failed":
      case "not_attempted":
        return "border-rose-600/50 bg-rose-50";
      default:
        return "border-[var(--border)]";
    }
  }

  function label(status: DayCellReport["status"]): string {
    switch (status) {
      case "has_marks":
        return "marks";
      case "verified_empty":
        return "blank?";
      case "has_unreadable":
        return "unreadable";
      case "date_uncertain":
        return "date?";
      case "extraction_failed":
        return "failed";
      case "not_attempted":
        return "missing";
      default:
        return status;
    }
  }

  return (
    <section className="card mx-auto max-w-6xl px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Photo day check</h3>
          <p className="text-xs text-[var(--muted)]">
            Compare each crop to the calendar. Failed/uncertain days must be reviewed before
            generate.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={photoConfirmed}
            onChange={(e) => onPhotoConfirmedChange(e.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          Sign-offs match the photo
        </label>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {dayReports.map((d) => (
          <div
            key={d.date}
            className={`overflow-hidden rounded-md border ${tone(d.status)}`}
            title={d.note ?? d.status}
          >
            <div className="px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide">
              {dayOfWeekFromDate(d.date).slice(0, 3)} {d.printedDay}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/ocr/crop?week=${encodeURIComponent(weekStart)}&day=${d.printedDay}&t=${encodeURIComponent(d.cropDebugName ?? "")}`}
              alt={`Day ${d.printedDay} crop`}
              className="aspect-[3/4] w-full object-cover object-top bg-white"
              loading="lazy"
            />
            <div className="px-1 py-0.5 text-center text-[10px] text-[var(--muted)]">
              {label(d.status)}
              {d.markCount > 0 ? ` · ${d.markCount}` : ""}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
