"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Clock, Minus, Pencil } from "lucide-react";
import { PageFrame } from "@/components/PageFrame";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { WeekBoard } from "@/components/WeekBoard";
import { useWeekBootstrap } from "@/components/useWeekBootstrap";
import {
  cellDetail,
  shiftAvailabilityConflict,
  toneForCell,
  toneLabel,
} from "@/components/availabilityTone";
import { apiFetch } from "@/lib/api/client";
import { buildShortNames, formatCompactEmployeeName } from "@/lib/displayName";
import { shiftToCellText } from "@/lib/shiftCellText";
import { formatShiftTimes, formatWeekRange, weekDates } from "@/lib/time";
import type { AvailabilityCell, Shift } from "@/lib/types";

function limitedLabel(cell: AvailabilityCell | null): string {
  if (cell?.window) return cellDetail(cell);
  const note = cell?.note?.trim();
  return note || "Limited";
}

function AvailabilityFace({ cell, clash }: { cell: AvailabilityCell | null; clash: boolean }) {
  const tone = toneForCell(cell);
  const ring = clash ? "avail-pill--clash" : "";
  if (tone === "available") {
    return (
      <span className={`avail-pill ${ring}`}>
        <Check size={14} strokeWidth={3} aria-hidden /> All day
      </span>
    );
  }
  if (tone === "limited") {
    return (
      <span className={`avail-pill avail-pill--limited ${ring}`}>
        <Clock size={13} aria-hidden /> {limitedLabel(cell)}
      </span>
    );
  }
  if (tone === "off") {
    return (
      <span className={`avail-pill avail-pill--off ${ring}`}>
        <Minus size={14} strokeWidth={3} aria-hidden /> Off
      </span>
    );
  }
  if (tone === "unclear") {
    return <span className={`avail-pill avail-pill--unclear ${ring}`}>Unclear</span>;
  }
  return <span className="week-board-dash">—</span>;
}

export default function AvailabilityPage() {
  const router = useRouter();
  const { weekStart, setWeekStart, data, error, reload } = useWeekBootstrap();
  const [selected, setSelected] = useState<{ employeeId: string; date: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const dates = useMemo(() => (weekStart ? weekDates(weekStart) : []), [weekStart]);
  const employees = useMemo(
    () =>
      (data?.employees ?? [])
        .filter((employee) => employee.status === "active")
        .sort((a, b) => formatCompactEmployeeName(a).localeCompare(formatCompactEmployeeName(b))),
    [data]
  );
  const names = useMemo(() => buildShortNames(employees), [employees]);
  const rows = useMemo(
    () => employees.map((employee) => ({ id: employee.id, name: names.get(employee.id) ?? employee.displayName })),
    [employees, names]
  );

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.85rem] leading-none sm:text-[2rem]">Weekly availability</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">This is employees&apos; availability before assigning shifts.</p>
        </div>
        {weekStart ? (
          <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--surface-2)]"
              aria-label="Previous week"
              onClick={() => shiftWeek(-7)}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-1 text-sm font-semibold">{formatWeekRange(weekStart)}</span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--surface-2)]"
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
      <div className="mt-4">
        {dates.length > 0 ? (
          <WeekBoard
            dates={dates}
            rows={rows}
            density="desk"
            caption="Weekly availability"
            renderCell={(row, date) => {
              const cell = cellFor(row.id, date);
              const tone = toneForCell(cell);
              const cellShifts = shiftsFor(row.id, date);
              const shiftText = cellShifts.map(shiftToCellText).join(" · ");
              const clash = cellShifts.some((shift) => shiftAvailabilityConflict(cell, shift));
              const active = selected?.employeeId === row.id && selected.date === date;
              return (
                <button
                  type="button"
                  aria-label={`${row.name}, ${format(parseISO(date), "EEEE MMM d")}, ${toneLabel(tone)}${
                    tone === "limited" ? `, ${limitedLabel(cell)}` : ""
                  }${shiftText ? `, scheduled ${shiftText}` : ""}${clash ? ", clashes with availability" : ""}`}
                  aria-pressed={active}
                  className={`week-board-cell ${active ? "is-active" : ""}`}
                  onClick={() => {
                    setSelected({ employeeId: row.id, date });
                    setEditing(false);
                  }}
                >
                  <AvailabilityFace cell={cell} clash={clash} />
                </button>
              );
            }}
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        )}
      </div>

      {selected && selectedEmployee ? (
        <section className="card mt-4 p-4 shadow-none" aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Selected day</p>
          {editing ? (
            <div className="mt-2 max-w-xl">
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
              <div className="w-36 shrink-0">
                <AvailabilityFace cell={selectedCell} clash={selectedShifts.some((shift) => shiftAvailabilityConflict(selectedCell, shift))} />
              </div>
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
          )}
          {!editing ? (
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
                          className="btn btn-ghost h-9 shrink-0 !text-xs"
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
        </section>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">Select a cell to see or change that person&apos;s availability.</p>
      )}

      <div className="mt-4 flex flex-col items-start gap-4">
        <div className="flex shrink-0 flex-col items-end gap-5 self-end text-right">
          <button type="button" className="btn btn-primary !h-14 !min-h-14 !px-8 !text-lg" disabled={!data} onClick={() => router.push("/admin/edit")}>
            Generate schedule →
          </button>
        </div>
        <div className="min-w-0">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)]" aria-label="Availability legend">
            <li className="flex items-center gap-1.5">
              <span className="legend-dot bg-[var(--avail-fg)]" /> Available (all day)
            </li>
            <li className="flex items-center gap-1.5">
              <span className="legend-dot bg-[#d89a1a]" /> Limited hours (shows times)
            </li>
            <li className="flex items-center gap-1.5">
              <span className="legend-dot bg-[var(--signoff-fg)]" /> Off
            </li>
            <li className="flex items-center gap-1.5">
              <span className="legend-dot ring-2 ring-[var(--conflict)]" /> Scheduled while unavailable
            </li>
          </ul>
        </div>
      </div>
    </PageFrame>
  );
}
