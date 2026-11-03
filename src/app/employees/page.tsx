"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/components/AuthProvider";
import { useAdminRequests } from "@/components/useScheduleRequests";
import { WeekToolbar } from "@/components/WeekToolbar";
import type { Employee, Shift, WeekSchedule } from "@/lib/types";
import { apiFetch } from "@/lib/api/client";
import { mergeTeamSchedule } from "@/lib/mergeTeamSchedule";
import { deleteRequestsForUser, requestErrorMessage } from "@/lib/scheduleRequests";
import { shiftToCellText } from "@/lib/shiftCellText";
import { dayOfWeekFromDate, formatWeekRange, shiftDurationHours, thisWeekMondayNy, weekDates } from "@/lib/time";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHORT_DAYS = ["M", "T", "W", "Th", "F", "Sa", "Su"];

type WeekStat = { shifts: number; hours: number; days: boolean[] };

function emptyStat(): WeekStat {
  return { shifts: 0, hours: 0, days: [false, false, false, false, false, false, false] };
}

function hoursLabel(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

function weekSummary(stat: WeekStat | undefined, ready: boolean): string {
  if (!ready || !stat) return "Loading this week…";
  if (stat.shifts === 0) return "No shifts";
  const count = `${stat.shifts} shift${stat.shifts === 1 ? "" : "s"}`;
  return stat.hours > 0 ? `${count} · ${hoursLabel(stat.hours)}` : count;
}

export default function EmployeesPage() {
  const { rosterVersion, schedulerVersion } = useAuth();
  const { requests } = useAdminRequests();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [weekStart, setWeekStart] = useState(thisWeekMondayNy);
  const [week, setWeek] = useState<WeekSchedule | null>(null);
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPrintedLabel, setNewPrintedLabel] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch("/api/employees")
      .then((r) => r.json())
      .then((j) => setEmployees(j.employees ?? []));
  }, [rosterVersion]);

  useEffect(() => {
    void apiFetch(`/api/bootstrap?week=${encodeURIComponent(weekStart)}&mode=shell`)
      .then((r) => r.json())
      .then((j) => setWeek(j.week ?? null));
  }, [weekStart, rosterVersion, schedulerVersion]);

  const mergedWeek = week
    ? mergeTeamSchedule({
        week,
        employees,
        approvedRequests: (requests ?? []).filter((request) => request.weekStart === weekStart),
      }).week
    : null;
  const weekStats = useMemo(() => {
    const stats = new Map<string, WeekStat>();
    for (const employee of employees) stats.set(employee.id, emptyStat());
    if (!mergedWeek) return stats;
    const dates = weekDates(mergedWeek.weekStart);
    for (const shift of mergedWeek.shifts) {
      if (!shift.employeeId) continue;
      const stat = stats.get(shift.employeeId);
      if (!stat) continue;
      stat.shifts += 1;
      stat.hours += shiftDurationHours(shift.startMinutes, shift.endMinutes);
      const index = dates.indexOf(shift.date);
      if (index >= 0) stat.days[index] = true;
    }
    return stats;
  }, [employees, mergedWeek]);

  const selectedShifts = useMemo(() => {
    if (!selected || !mergedWeek) return [];
    const dates = weekDates(mergedWeek.weekStart);
    return dates
      .map((date) => ({
        date,
        shifts: mergedWeek.shifts.filter((s) => s.employeeId === selected.id && s.date === date),
      }))
      .filter((row) => row.shifts.length > 0);
  }, [selected, mergedWeek]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    const res = await apiFetch("/api/employees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee: selected }),
    });
    const json = await res.json();
    setEmployees((prev) => prev.map((e) => (e.id === json.employee.id ? json.employee : e)));
    setSelected(json.employee);
    setSaving(false);
  }

  async function addEmployee() {
    const displayName = newDisplayName.trim();
    if (!displayName) return;
    setAdding(true);
    const res = await apiFetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        printedLabel: newPrintedLabel.trim() || displayName,
      }),
    });
    const json = await res.json();
    if (res.ok && json.employee) {
      setEmployees((prev) => [...prev, json.employee]);
      setAddOpen(false);
      setSelected(json.employee);
      setNewDisplayName("");
      setNewPrintedLabel("");
    }
    setAdding(false);
  }

  async function deleteEmployee() {
    if (!selected) return;
    const name = selected.displayName;
    if (
      !window.confirm(
        `Permanently delete ${name}? Their availability, shifts, saved schedule data, and approval requests will be deleted.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    const id = selected.id;
    try {
      await deleteRequestsForUser(id);
    } catch (error) {
      const message = requestErrorMessage(error);
      setDeleteError(
        message.startsWith("Could not send")
          ? message.replace("Could not send", "Could not delete schedule data")
          : message
      );
      setDeleting(false);
      return;
    }
    const res = await apiFetch("/api/employees", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: id }),
    });
    if (res.ok) {
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      setSelected(null);
      const boot = await apiFetch(`/api/bootstrap?week=${encodeURIComponent(weekStart)}&mode=shell`);
      const j = await boot.json();
      setWeek(j.week ?? null);
    } else {
      setDeleteError("Could not delete this employee.");
    }
    setDeleting(false);
  }

  function shiftLine(shift: Shift): string {
    return shiftToCellText(shift);
  }

  function closePanel() {
    setSelected(null);
    setAddOpen(false);
    setDeleteError(null);
  }

  function openEmployee(employee: Employee) {
    setAddOpen(false);
    setDeleteError(null);
    setSelected(structuredClone(employee));
  }

  useEffect(() => {
    if (!selected && !addOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected(null);
        setAddOpen(false);
        setDeleteError(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, addOpen]);

  return (
    <div className="flex h-dvh flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <AppHeader />
      <WeekToolbar weekStart={weekStart} onChangeWeek={setWeekStart} />

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.85rem] leading-none sm:text-[2rem]">Employees</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Names on the weekly schedule. Each card is this week.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelected(null);
              setDeleteError(null);
              setAddOpen(true);
            }}
          >
            Add employee
          </button>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Employees">
          {employees.map((employee) => {
            const stat = weekStats.get(employee.id);
            const summary = weekSummary(stat, Boolean(mergedWeek));
            return (
              <li key={employee.id}>
                <button
                  type="button"
                  className={`card flex h-full w-full cursor-pointer flex-col px-3 py-3 text-left font-sans text-inherit transition-colors hover:bg-[var(--surface-2)] ${
                    employee.status !== "active" ? "opacity-70" : ""
                  }`}
                  aria-current={selected?.id === employee.id ? "true" : undefined}
                  aria-label={`${employee.displayName}, printed as ${employee.printedLabel}, ${summary}${
                    employee.status !== "active" ? ", inactive" : ""
                  }`}
                  onClick={() => openEmployee(employee)}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{employee.displayName}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{employee.printedLabel}</span>
                    </span>
                    {employee.status !== "active" ? <span className="tag shrink-0">Inactive</span> : null}
                  </span>
                  <span className="mt-2 text-sm font-semibold">{summary}</span>
                  <span className="mt-3 grid grid-cols-7 gap-1" aria-hidden>
                    {SHORT_DAYS.map((label, index) => (
                      <span key={label} className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-semibold leading-none text-[var(--muted)]">{label}</span>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            stat?.days[index]
                              ? "bg-[var(--chrome)]"
                              : "bg-transparent ring-1 ring-[var(--border-strong)]"
                          }`}
                        />
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </main>

      {addOpen || selected ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
          onClick={closePanel}
          role="presentation"
        >
          <div
            className="card flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden shadow-lg"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-panel-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <div className="min-w-0">
                <h2 id="employee-panel-title" className="text-lg leading-tight">
                  {addOpen ? "Add employee" : selected?.displayName}
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  {addOpen
                    ? "Shown on the weekly schedule grid."
                    : week
                      ? formatWeekRange(week.weekStart)
                      : "Loading this week…"}
                </p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface)]"
                aria-label="Close"
                onClick={closePanel}
              >
                <X size={18} />
              </button>
            </div>

            {addOpen ? (
              <form
                className="space-y-3 overflow-y-auto p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addEmployee();
                }}
              >
                <label>
                  <span className="field-label">Display name</span>
                  <input
                    className="input"
                    value={newDisplayName}
                    placeholder="Jordan Smith"
                    autoFocus
                    onChange={(event) => setNewDisplayName(event.target.value)}
                  />
                </label>
                <label>
                  <span className="field-label">Printed on schedule (optional)</span>
                  <input
                    className="input"
                    value={newPrintedLabel}
                    placeholder="J. Smith"
                    onChange={(event) => setNewPrintedLabel(event.target.value)}
                  />
                </label>
                <button type="submit" className="btn btn-primary" disabled={adding || !newDisplayName.trim()}>
                  {adding ? "Adding…" : "Add employee"}
                </button>
              </form>
            ) : selected ? (
              <div className="min-h-0 overflow-y-auto">
                <div className="space-y-3 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="field-label">Display name</span>
                      <input
                        className="input"
                        value={selected.displayName}
                        autoFocus
                        onChange={(event) => setSelected({ ...selected, displayName: event.target.value })}
                      />
                    </label>
                    <label>
                      <span className="field-label">Printed on schedule</span>
                      <input
                        className="input"
                        value={selected.printedLabel}
                        onChange={(event) => setSelected({ ...selected, printedLabel: event.target.value })}
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.status === "active"}
                      onChange={(event) =>
                        setSelected({
                          ...selected,
                          status: event.target.checked ? "active" : "inactive",
                        })
                      }
                    />
                    Active on schedule
                  </label>

                  <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                    <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-danger"
                      disabled={deleting}
                      onClick={() => void deleteEmployee()}
                    >
                      {deleting ? "Removing…" : "Delete employee"}
                    </button>
                  </div>
                  {deleteError ? (
                    <p role="alert" className="text-sm text-[var(--conflict)]">
                      {deleteError}
                    </p>
                  ) : null}
                </div>

                <div className="border-t border-[var(--border)]">
                  <h3 className="px-4 pt-3 text-[15px]">This week&apos;s shifts</h3>
                  {!week ? (
                    <p className="px-4 py-3 text-sm text-[var(--muted)]">Loading schedule…</p>
                  ) : selectedShifts.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-[var(--muted)]">No shifts scheduled this week.</p>
                  ) : (
                    <table className="w-full border-collapse text-sm tabular-nums">
                      <tbody>
                        {selectedShifts.map(({ date, shifts }) => (
                          <tr key={date} className="border-b border-[var(--grid-line)] last:border-0">
                            <td className="w-32 px-4 py-1.5 font-semibold">
                              {DAY_LABELS[weekDates(week.weekStart).indexOf(date)] ?? dayOfWeekFromDate(date)}{" "}
                              <span className="font-normal text-[var(--muted)]">{date.slice(5).replace("-", "/")}</span>
                            </td>
                            <td className="px-2 py-1.5 font-semibold">{shifts.map((shift) => shiftLine(shift)).join(" · ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
                    Edit shifts on the{" "}
                    <a href="/admin/edit" className="font-semibold text-[var(--accent)] underline">
                      weekly schedule
                    </a>
                    .
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
