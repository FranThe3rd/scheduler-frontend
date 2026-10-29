"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/components/AuthProvider";
import { useAdminRequests } from "@/components/useScheduleRequests";
import { WeekToolbar } from "@/components/WeekToolbar";
import type { Employee, Shift, WeekSchedule } from "@/lib/types";
import { apiFetch } from "@/lib/api/client";
import { mergeTeamSchedule } from "@/lib/mergeTeamSchedule";
import { deleteRequestsForUser, requestErrorMessage } from "@/lib/scheduleRequests";
import { shiftToCellText } from "@/lib/shiftCellText";
import { dayOfWeekFromDate, formatWeekRange, thisWeekMondayNy, weekDates } from "@/lib/time";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function EmployeesPage() {
  const { rosterVersion, schedulerVersion } = useAuth();
  const { requests } = useAdminRequests();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [weekStart, setWeekStart] = useState(thisWeekMondayNy);
  const [week, setWeek] = useState<WeekSchedule | null>(null);
  const [adding, setAdding] = useState(false);
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

  return (
    <div className="flex h-dvh flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <AppHeader />
      <WeekToolbar weekStart={weekStart} onChangeWeek={setWeekStart} />

      <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-3 sm:px-4">
        <div className="mr-2">
          <h1 className="text-base font-semibold">Employees</h1>
          <p className="text-xs text-[var(--muted)]">
            Names shown on the weekly schedule grid.
          </p>
        </div>
        <label className="w-full sm:w-48">
          <span className="field-label">Display name</span>
          <input
            className="input"
            value={newDisplayName}
            placeholder="Jordan Smith"
            onChange={(e) => setNewDisplayName(e.target.value)}
          />
        </label>
        <label className="w-full sm:w-48">
          <span className="field-label">Printed on schedule (optional)</span>
          <input
            className="input"
            value={newPrintedLabel}
            placeholder="J. Smith"
            onChange={(e) => setNewPrintedLabel(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary w-full sm:w-auto"
          disabled={adding || !newDisplayName.trim()}
          onClick={() => void addEmployee()}
        >
          {adding ? "Adding…" : "Add employee"}
        </button>
      </div>

      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <ul
          className="max-h-60 shrink-0 overflow-y-auto border-b border-[var(--border)] bg-[var(--surface)] md:max-h-none md:w-72 md:border-b-0 md:border-r"
          aria-label="Employees"
        >
          {employees.map((e) => (
            <li key={e.id} className="border-b border-[var(--grid-line)]">
              <button
                type="button"
                className={`flex w-full items-center gap-2 border-l-[3px] px-3 py-1.5 text-left transition-colors hover:bg-[var(--surface-2)] ${
                  selected?.id === e.id
                    ? "border-[var(--accent)] bg-[var(--accent-bg)]"
                    : "border-transparent"
                }`}
                aria-current={selected?.id === e.id ? "true" : undefined}
                onClick={() => setSelected(structuredClone(e))}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{e.displayName}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {e.printedLabel}
                  </span>
                </span>
                {e.status !== "active" ? <span className="tag">Inactive</span> : null}
              </button>
            </li>
          ))}
        </ul>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {selected ? (
            <div className="max-w-3xl space-y-4">
              <section className="card">
                <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2">
                  <h2 className="text-[15px] font-semibold">{selected.displayName}</h2>
                </div>
                <div className="space-y-3 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="field-label">Display name</span>
                      <input
                        className="input"
                        value={selected.displayName}
                        onChange={(e) => setSelected({ ...selected, displayName: e.target.value })}
                      />
                    </label>
                    <label>
                      <span className="field-label">Printed on schedule</span>
                      <input
                        className="input"
                        value={selected.printedLabel}
                        onChange={(e) =>
                          setSelected({ ...selected, printedLabel: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.status === "active"}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          status: e.target.checked ? "active" : "inactive",
                        })
                      }
                    />
                    Active on schedule
                  </label>

                  <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saving}
                      onClick={() => void save()}
                    >
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
              </section>

              <section className="card">
                <div className="flex items-baseline justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2">
                  <h2 className="text-[15px] font-semibold">This week&apos;s shifts</h2>
                  <span className="text-xs text-[var(--muted)]">
                    {week ? formatWeekRange(week.weekStart) : "Loading…"}
                  </span>
                </div>
                {!week ? (
                  <p className="px-4 py-3 text-sm text-[var(--muted)]">Loading schedule…</p>
                ) : selectedShifts.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--muted)]">
                    No shifts scheduled this week.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-sm tabular-nums">
                    <tbody>
                      {selectedShifts.map(({ date, shifts }) => (
                        <tr key={date} className="border-b border-[var(--grid-line)] last:border-0">
                          <td className="w-32 px-4 py-1.5 font-semibold">
                            {DAY_LABELS[weekDates(week.weekStart).indexOf(date)] ??
                              dayOfWeekFromDate(date)}{" "}
                            <span className="font-normal text-[var(--muted)]">
                              {date.slice(5).replace("-", "/")}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 font-semibold">
                            {shifts.map((s) => shiftLine(s)).join(" · ")}
                          </td>
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
              </section>
            </div>
          ) : (
            <p className="text-[var(--muted)]">Select an employee.</p>
          )}
        </div>
      </main>
    </div>
  );
}
