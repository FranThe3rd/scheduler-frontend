"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Clock, Minus, Pencil } from "lucide-react";
import { PageFrame } from "@/components/PageFrame";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { useWeekBootstrap } from "@/components/useWeekBootstrap";
import {
  availabilityShortLabel,
  cellDetail,
  shiftAvailabilityConflict,
  toneForCell,
  toneLabel,
} from "@/components/availabilityTone";
import { chipStyle } from "@/components/shiftChip";
import { apiFetch } from "@/lib/api/client";
import { buildShortNames, formatCompactEmployeeName } from "@/lib/displayName";
import { shiftToCellText } from "@/lib/shiftCellText";
import { formatShiftTimes, formatWeekRange, weekDates } from "@/lib/time";
import type { AvailabilityCell, Shift } from "@/lib/types";
import type { AvailabilityTone as Tone } from "@/components/availabilityTone";

function Mark({ tone, size = "sm" }: { tone: Tone; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-9 w-9" : "h-6 w-6";
  const icon = size === "lg" ? 16 : 12;
  if (tone === "available") {
    return (
      <span className={`flex ${box} items-center justify-center rounded-full bg-[#b7d7a8] text-[#245033]`}>
        <Check size={icon} strokeWidth={3} />
      </span>
    );
  }
  if (tone === "limited") {
    return (
      <span className={`flex ${box} items-center justify-center rounded-full bg-[#f3d56a] text-[#6d5310]`}>
        <Clock size={icon} />
      </span>
    );
  }
  if (tone === "off") {
    return (
      <span className={`flex ${box} items-center justify-center rounded-full bg-[#f4b7b8] text-[#8d3d45]`}>
        <Minus size={icon} strokeWidth={3} />
      </span>
    );
  }
  return <span className={`block ${box} rounded-full border border-dashed border-[#d9cfc2]`} />;
}

/** Tiny text under a circle so limited hours are readable without tapping. */
function cellLabel(cell: AvailabilityCell | null, tone: Tone): string {
  return tone === "limited" ? availabilityShortLabel(cell) : "";
}

export default function AvailabilityPage() {
  const router = useRouter();
  const { weekStart, setWeekStart, data, error, reload } = useWeekBootstrap();
  const [selected, setSelected] = useState<{ employeeId: string; date: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const dates = weekStart ? weekDates(weekStart) : [];
  const employees = useMemo(
    () =>
      (data?.employees ?? [])
        .filter((employee) => employee.status === "active")
        .sort((a, b) => formatCompactEmployeeName(a).localeCompare(formatCompactEmployeeName(b))),
    [data]
  );
  const names = useMemo(() => buildShortNames(employees), [employees]);

  function cellFor(employeeId: string, date: string): AvailabilityCell | null {
    return data?.week.availability.find((row) => row.employeeId === employeeId)?.cells[date] ?? null;
  }

  const selectedEmployee = employees.find((employee) => employee.id === selected?.employeeId) ?? null;
  const selectedCell = selected ? cellFor(selected.employeeId, selected.date) : null;
  const selectedTone = toneForCell(selectedCell);

  function shiftsFor(employeeId: string, date: string): Shift[] {
    return (data?.week.shifts ?? [])
      .filter((shift) => shift.employeeId === employeeId && shift.date === date)
      .sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0));
  }
  const selectedShifts = selected ? shiftsFor(selected.employeeId, selected.date) : [];

  async function removeShift(shiftId: string) {
    if (!weekStart) return;
    setSaving(true);
    const res = await apiFetch("/api/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, action: "delete", shiftId }),
    });
    if (res.ok) reload();
    setSaving(false);
  }

  async function saveCell(cell: AvailabilityCell) {
    if (!selected || !weekStart) return;
    setSaving(true);
    const res = await apiFetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, employeeId: selected.employeeId, date: selected.date, cell }),
    });
    if (res.ok) {
      setEditing(false);
      reload();
    }
    setSaving(false);
  }

  function shiftWeek(days: number) {
    if (!weekStart) return;
    setWeekStart(format(addDays(parseISO(weekStart), days), "yyyy-MM-dd"));
  }

  return (
    <PageFrame>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-none sm:text-[2rem]">Availability</h1>
          <p className="mt-1 text-sm font-semibold">{weekStart ? formatWeekRange(weekStart) : "Loading…"}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Step 2 of 3 · Everyone&apos;s availability and days off. Tap a circle to change it, then build the schedule.
          </p>
        </div>
        {weekStart ? (
          <div className="flex shrink-0 gap-1 pb-1">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)]"
              aria-label="Previous week"
              onClick={() => shiftWeek(-7)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)]"
              aria-label="Next week"
              onClick={() => shiftWeek(7)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--conflict)]">
          {error}
        </p>
      ) : null}
      {data && employees.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-[var(--surface)] px-3 py-3 text-sm">
          No staff yet. Employees show up here automatically after they sign in with Google.
        </p>
      ) : null}
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,20rem)] lg:items-start">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full table-fixed border-collapse text-center">
              <colgroup>
                <col style={{ width: "4.5rem" }} />
                {dates.map((date) => (
                  <col key={date} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-[var(--muted)]">Employee</th>
                  {dates.map((date) => (
                    <th key={date} className="py-1.5 text-[11px] font-semibold leading-tight text-[var(--muted)]">
                      <span className="block">{format(parseISO(date), "EEEEE")}</span>
                      <span className="block font-normal">{format(parseISO(date), "d")}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-[var(--border)] last:border-b-0">
                    <th scope="row" className="truncate px-2 py-1 text-left text-[13px] font-semibold">
                      {names.get(employee.id)}
                    </th>
                    {dates.map((date) => {
                      const cell = cellFor(employee.id, date);
                      const tone = toneForCell(cell);
                      const label = cellLabel(cell, tone);
                      const cellShifts = shiftsFor(employee.id, date);
                      const shiftText = cellShifts.map(shiftToCellText).join(" · ");
                      const clash = cellShifts.some((shift) => shiftAvailabilityConflict(cell, shift));
                      const active = selected?.employeeId === employee.id && selected.date === date;
                      return (
                        <td key={date} className="p-0">
                          <button
                            type="button"
                            aria-label={`${names.get(employee.id)}, ${format(parseISO(date), "EEEE MMM d")}, ${toneLabel(tone)}${
                              shiftText ? `, scheduled ${shiftText}` : ""
                            }${clash ? ", clashes with availability" : ""}`}
                            aria-pressed={active}
                            className={`mx-auto flex min-h-10 w-full flex-col items-center justify-center gap-px ${
                              active ? "bg-[#ece3d4]" : ""
                            }`}
                            onClick={() => {
                              setSelected({ employeeId: employee.id, date });
                              setEditing(false);
                            }}
                          >
                            <span className={clash ? "rounded-full ring-2 ring-[var(--conflict)]" : ""}>
                              <Mark tone={tone} />
                            </span>
                            <span className="h-2.5 text-[8px] font-semibold leading-[10px] text-[var(--muted)]">{label}</span>
                            {shiftText ? (
                              <span
                                className={`max-w-full truncate rounded px-0.5 text-[8px] font-semibold leading-[11px] ${chipStyle(shiftText)}`}
                              >
                                {shiftText}
                              </span>
                            ) : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              {employees.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-[var(--border)] bg-[var(--surface-2)]">
                    <th scope="row" className="px-2 py-1.5 text-left text-[11px] font-semibold text-[var(--muted)]">
                      Off / Ltd
                    </th>
                    {dates.map((date) => {
                      let off = 0;
                      let limited = 0;
                      for (const employee of employees) {
                        const tone = toneForCell(cellFor(employee.id, date));
                        if (tone === "off") off += 1;
                        if (tone === "limited") limited += 1;
                      }
                      return (
                        <td key={date} className="py-1.5 text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                          {off}/{limited}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-t border-[var(--border)] bg-[var(--surface-2)]">
                    <th scope="row" className="px-2 py-1.5 text-left text-[11px] font-semibold text-[var(--muted)]">
                      Working
                    </th>
                    {dates.map((date) => (
                      <td key={date} className="py-1.5 text-[11px] font-semibold tabular-nums">
                        {employees.filter((employee) => shiftsFor(employee.id, date).length > 0).length}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
          <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]" aria-label="Availability legend">
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#b7d7a8]" /> Available
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#f3d56a]" /> Limited
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#f4b7b8]" /> Off
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-dashed border-[#d9cfc2]" /> Not set
            </li>
            <li className="flex items-center gap-1.5">
              <span className="rounded bg-[#b7d7a8] px-1 text-[9px] font-semibold text-[#245033]">9–3</span> Scheduled
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full ring-2 ring-[var(--conflict)]" /> Scheduled while unavailable
            </li>
          </ul>
        </div>

        <section className="card p-3 shadow-none" aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Selected day</p>
          {selected && selectedEmployee ? (
            editing ? (
              <div className="mt-2">
                <p className="font-serif text-lg leading-tight">{names.get(selectedEmployee.id)}</p>
                <p className="text-sm text-[var(--muted)]">{format(parseISO(selected.date), "EEEE, MMM d")}</p>
                <div className="mt-3">
                  <AvailabilityEditor
                    key={`${selected.employeeId}-${selected.date}-${selectedCell?.kind ?? "empty"}`}
                    cell={selectedCell}
                    saving={saving}
                    onSave={(cell) => void saveCell(cell)}
                    formId="availability-day-form"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-3">
                <Mark tone={selectedTone} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg leading-tight">{names.get(selectedEmployee.id)}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {format(parseISO(selected.date), "EEE, MMM d")} · {toneLabel(selectedTone)}
                    {selectedTone === "limited" || selectedTone === "off" || selectedTone === "unclear"
                      ? ` (${cellDetail(selectedCell)})`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)]"
                  aria-label="Edit this day"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={15} />
                </button>
              </div>
            )
          ) : null}
          {selected && selectedEmployee && !editing ? (
            selectedShifts.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Not scheduled this day.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {selectedShifts.map((shift) => {
                  const clash = shiftAvailabilityConflict(selectedCell, shift);
                  return (
                    <li key={shift.id} className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          Scheduled{" "}
                          {shift.startMinutes != null && shift.endMinutes != null
                            ? formatShiftTimes(shift.startMinutes, shift.endMinutes)
                            : shiftToCellText(shift)}
                        </p>
                        {clash ? <p className="text-xs font-semibold text-[var(--conflict)]">{clash}</p> : null}
                      </div>
                      {clash ? (
                        <button
                          type="button"
                          className="btn btn-ghost h-9 shrink-0 rounded-full !text-xs"
                          disabled={saving}
                          onClick={() => void removeShift(shift.id)}
                        >
                          Remove shift
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
          {!selected || !selectedEmployee ? (
            <p className="mt-1 text-sm text-[var(--muted)]">Tap a circle to see or change that person&apos;s availability.</p>
          ) : null}
        </section>
      </div>
      <button
        type="button"
        className="btn btn-primary mt-4 h-12 w-full rounded-full text-base md:w-auto md:min-w-64"
        disabled={!data}
        onClick={() => router.push("/admin/edit")}
      >
        Build schedule →
      </button>
      <p className="mt-2 text-center text-xs text-[var(--muted)] md:text-left">
        You choose who works and when on the next screen — nothing is assigned automatically.
      </p>
    </PageFrame>
  );
}
