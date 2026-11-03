"use client";

import { useRef } from "react";
import { format, parseISO } from "date-fns";
import type { ReactNode } from "react";
import { WaffleScrollCover } from "@/components/WaffleScrollCover";

export type WeekBoardRow = { id: string; name: string };

const SHORT_DOW = ["Su", "M", "T", "W", "Th", "F", "Sa"] as const;

function dayHead(date: string) {
  const parsed = parseISO(date);
  const dow = parsed.getDay();
  return {
    long: format(parsed, "EEE"),
    short: SHORT_DOW[dow],
    dom: format(parsed, "d"),
    weekend: dow === 0 || dow === 6,
  };
}

/**
 * Shared Monday–Sunday board. Availability and schedule pages use the same
 * columns, spacing, and sticky name column; only the cell contents differ.
 */
export function WeekBoard({
  dates,
  rows,
  renderCell,
  highlightRowId,
  selectedDate,
  onDay,
  caption = "Week",
  density = "regular",
  schedule = false,
}: {
  dates: string[];
  rows: WeekBoardRow[];
  renderCell: (row: WeekBoardRow, date: string) => ReactNode;
  highlightRowId?: string | null;
  selectedDate?: string | null;
  onDay?: (date: string) => void;
  caption?: string;
  /** Desktop admin boards: shorter rows so the roster fits in about one scroll. */
  density?: "regular" | "desk";
  /** Schedule grids get a phone layout that keeps every day on screen. */
  schedule?: boolean;
}) {
  const desk = density === "desk";
  const headRef = useRef<HTMLTableSectionElement>(null);
  const tableClass = ["week-board", desk ? "week-board--desk" : "", schedule ? "week-board--schedule" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="week-board-scroll">
      {schedule ? <WaffleScrollCover anchorRef={headRef} /> : null}
      <table className={tableClass}>
        <caption className="sr-only">{caption}</caption>
        <thead ref={headRef}>
          <tr>
            <th className="week-board-name" scope="col">
              Employee
            </th>
            {dates.map((date) => {
              const head = dayHead(date);
              return (
              <th key={date} scope="col" className={head.weekend ? "is-weekend" : undefined}>
                {onDay ? (
                  <button
                    type="button"
                    className={selectedDate === date ? "is-selected" : undefined}
                    onClick={() => onDay(date)}
                  >
                    <span className="week-board-dow week-board-dow--long">{head.long}</span>
                    <span className="week-board-dow week-board-dow--short">{head.short}</span>
                    <span className="week-board-dom">{head.dom}</span>
                  </button>
                ) : (
                  <span className="flex min-h-[3.25rem] flex-col items-center justify-center py-2">
                    <span className="week-board-dow week-board-dow--long">{head.long}</span>
                    <span className="week-board-dow week-board-dow--short">{head.short}</span>
                    <span className="week-board-dom">{head.dom}</span>
                  </span>
                )}
              </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const mine = highlightRowId != null && row.id === highlightRowId;
            return (
              <tr key={row.id} className={mine ? "week-board-row--me" : undefined}>
                <th className="week-board-name" scope="row" title={row.name}>
                  <span className="week-board-name-text">{row.name}</span>
                  {mine ? <span className="week-board-you">You</span> : null}
                </th>
                {dates.map((date) => {
                  const head = dayHead(date);
                  const flags = [
                    selectedDate === date ? "is-selected" : "",
                    head.weekend ? "is-weekend" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                  <td key={date} className={flags || undefined}>
                    {renderCell(row, date)}
                  </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
