"use client";

import { useRef } from "react";
import { format, parseISO } from "date-fns";
import type { Employee, Shift, WeekSchedule } from "@/lib/types";
import { buildScheduleTableMatrix } from "@/lib/scheduleGridTable";
import { WaffleScrollCover } from "@/components/WaffleScrollCover";

export function ScheduleTable({
  week,
  employees,
  shifts,
  className = "",
}: {
  week: WeekSchedule;
  employees: Employee[];
  shifts?: Shift[];
  className?: string;
}) {
  const headRef = useRef<HTMLTableSectionElement>(null);
  const { headers, body, dates } = buildScheduleTableMatrix(week, employees, shifts);

  return (
    <table
      className={`sched-matrix w-full border-collapse text-sm ${className}`}
      aria-label="Weekly schedule table"
    >
      <WaffleScrollCover anchorRef={headRef} />
      <thead ref={headRef}>
        <tr className="bg-[var(--surface-2)]">
          {headers.map((h, i) => (
            <th
              key={h}
              className="border border-[var(--border)] px-2 py-2 text-left text-xs font-semibold"
            >
              {i === 0 ? (
                h
              ) : (
                <>
                  <span className="sched-matrix-long">{h}</span>
                  <span className="sched-matrix-short">
                    <span className="block">{format(parseISO(dates[i - 1]!), "EEEEE")}</span>
                    <span className="block font-normal">{format(parseISO(dates[i - 1]!), "d")}</span>
                  </span>
                </>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, ri) => (
          <tr key={ri} className="border-b border-[var(--border)]">
            {row.map((cell, ci) => (
              <td
                key={ci}
                title={ci === 0 ? cell : undefined}
                className={`border border-[var(--border)] px-2 py-2 align-top text-center ${
                  ci === 0 ? "text-left font-semibold" : ""
                } ${cell === "—" ? "text-[var(--muted)]" : ""} ${
                  cell === "Unclear" ? "bg-[var(--unclear)] font-medium" : ""
                }`}
              >
                {cell.split("\n").map((line, li) => (
                  <span key={li} className="block leading-snug">
                    {line}
                  </span>
                ))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
