import type { Employee, Shift, WeekSchedule } from "@/lib/types";
import { buildScheduleTableMatrix } from "@/lib/scheduleGridTable";

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
  const { headers, body } = buildScheduleTableMatrix(week, employees, shifts);

  return (
    <table
      className={`w-full border-collapse text-sm ${className}`}
      aria-label="Weekly schedule table"
    >
      <thead>
        <tr className="bg-[var(--surface-2)]">
          {headers.map((h) => (
            <th
              key={h}
              className="border border-[var(--border)] px-2 py-2 text-left text-xs font-semibold"
            >
              {h}
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
