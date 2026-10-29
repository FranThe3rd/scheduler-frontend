"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO, startOfMonth } from "date-fns";
import { PageFrame } from "@/components/PageFrame";
import { MonthCalendar } from "@/components/MonthCalendar";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { toneForCell, toneLabel, type AvailabilityTone } from "@/components/availabilityTone";
import { apiFetch } from "@/lib/api/client";
import { useEmployeeId, useToday } from "@/components/useClientSession";
import { useAuth } from "@/components/AuthProvider";
import { WeekSubmitPanel } from "@/components/WeekSubmitPanel";
import { listMyRequests, subscribeMyRequests, type ScheduleRequest } from "@/lib/scheduleRequests";
import { initialsFor } from "@/lib/createEmployee";
import type { AvailabilityCell, Employee, WeekSchedule } from "@/lib/types";
import { formatWeekRange, mondayOf } from "@/lib/time";

const LEGEND: AvailabilityTone[] = ["available", "limited", "off"];

function mondayKey(date: string): string {
  return format(mondayOf(date), "yyyy-MM-dd");
}

export default function MyAvailabilityPage() {
  const employeeId = useEmployeeId();
  const { user, rosterVersion, schedulerVersion } = useAuth();
  const today = useToday();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [weeks, setWeeks] = useState<Record<string, WeekSchedule>>({});
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);
  const [pickedWeek, setPickedWeek] = useState<string | null>(null);
  // Where the day editor shows: beside the calendar, or inside the week section below.
  const [editorSpot, setEditorSpot] = useState<"calendar" | "panel">("calendar");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [mine, setMine] = useState<ScheduleRequest[]>([]);
  const calendarEditorRef = useRef<HTMLElement | null>(null);
  const panelEditorRef = useRef<HTMLDivElement | null>(null);

  /** On phones the editor sits below the calendar; bring it into view after a tap. */
  function revealEditor(spot: "calendar" | "panel") {
    if (typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches) return;
    const target = spot === "calendar" ? calendarEditorRef.current : panelEditorRef.current;
    window.requestAnimationFrame(() => {
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  const reloadRequests = useCallback(async () => {
    if (!user) return;
    try {
      setMine(await listMyRequests(user.uid));
    } catch {
      setMine([]);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeMyRequests(user.uid, setMine, () => setMine([]));
  }, [user]);

  useEffect(() => {
    void apiFetch("/api/employees")
      .then((res) => res.json())
      .then((json) => setEmployees(json.employees ?? []));
  }, [rosterVersion]);

  const employee = employees.find((item) => item.id === employeeId) ?? null;

  useEffect(() => {
    const first = format(month, "yyyy-MM-01");
    const last = format(new Date(month.getFullYear(), month.getMonth() + 1, 0), "yyyy-MM-dd");
    const keys: string[] = [];
    let cursor = mondayOf(first);
    const end = format(mondayOf(last), "yyyy-MM-dd");
    while (format(cursor, "yyyy-MM-dd") <= end) {
      keys.push(format(cursor, "yyyy-MM-dd"));
      cursor = addDays(cursor, 7);
    }
    let cancelled = false;
    void Promise.all(
      keys.map(async (week) => {
        const res = await apiFetch(`/api/bootstrap?week=${encodeURIComponent(week)}&mode=shell`);
        if (!res.ok) return null;
        const json = await res.json();
        return [week, json.week as WeekSchedule] as const;
      })
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<string, WeekSchedule> = {};
      for (const row of rows) {
        if (row) next[row[0]] = row[1];
      }
      setWeeks(next);
    });
    return () => {
      cancelled = true;
    };
  }, [month, rosterVersion, schedulerVersion]);

  const marks = useMemo(() => {
    if (!employeeId) return {};
    const out: Record<string, AvailabilityTone> = {};
    for (const week of Object.values(weeks)) {
      const row = week.availability.find((item) => item.employeeId === employeeId);
      if (!row) continue;
      for (const [date, cell] of Object.entries(row.cells)) {
        out[date] = toneForCell(cell);
      }
    }
    return out;
  }, [weeks, employeeId]);

  const selectedCell = useMemo(() => {
    if (!selected || !employeeId) return null;
    const week = weeks[mondayKey(selected)];
    return week?.availability.find((item) => item.employeeId === employeeId)?.cells[selected] ?? null;
  }, [selected, employeeId, weeks]);

  async function saveDay(cell: AvailabilityCell) {
    if (!selected || !employeeId) return;
    if (mine.some((r) => r.weekStart === mondayKey(selected) && r.status === "approved")) {
      setError("This week was approved by your manager, so it's locked.");
      return;
    }
    if (today && selected < today) {
      setError("You can't change availability for days that have already passed.");
      return;
    }
    setSaving(true);
    setError(null);
    const weekStart = mondayKey(selected);
    const res = await apiFetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, employeeId, date: selected, cell }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not save this day.");
      setSaving(false);
      return;
    }
    setWeeks((prev) => ({ ...prev, [weekStart]: json.week }));
    setSaving(false);
  }

  const thisMonday = mondayKey(today ?? format(new Date(), "yyyy-MM-dd"));
  const panelWeek = pickedWeek ?? thisMonday;

  /** Jump to a week (never before this week) and open its first day that hasn't passed. */
  function goToWeek(monday: string) {
    if (monday < thisMonday) return;
    const firstOpenDay = today && monday < today ? today : monday;
    setPickedWeek(monday);
    setEditorSpot("calendar");
    setSelected(firstOpenDay);
    setMonth(startOfMonth(parseISO(firstOpenDay)));
    setError(null);
  }
  const selectedLocked =
    !!selected && mine.some((r) => r.weekStart === mondayKey(selected) && r.status === "approved");

  async function saveName() {
    if (!employee) return;
    const name = nameDraft.trim().replace(/\s+/g, " ");
    if (!name) {
      setNameError("Enter the name you want shown.");
      return;
    }
    if (name.length > 40) {
      setNameError("Keep it under 40 characters.");
      return;
    }
    setNameSaving(true);
    setNameError(null);
    const updated: Employee = {
      ...employee,
      displayName: name,
      printedLabel: name,
      initials: initialsFor(name, name),
    };
    const res = await apiFetch("/api/employees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee: updated }),
    });
    setNameSaving(false);
    if (!res.ok) {
      setNameError("Could not save your name.");
      return;
    }
    setEmployees((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setEditingName(false);
  }

  if (!employeeId) {
    return (
      <PageFrame>
        <p className="text-[var(--muted)]">Setting up your profile…</p>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <h1 className="text-[1.75rem] leading-tight sm:text-[2rem]">My availability</h1>
      {editingName ? (
        <form
          className="mt-2 flex flex-wrap items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveName();
          }}
        >
          <div>
            <label className="field-label" htmlFor="display-name">
              Name shown on the schedule
            </label>
            <input
              id="display-name"
              className="input"
              value={nameDraft}
              maxLength={40}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
            />
            {nameError ? <p className="mt-1 text-sm text-[var(--conflict)]">{nameError}</p> : null}
          </div>
          <div className="flex gap-2 pt-6">
            <button type="submit" className="btn btn-primary" disabled={nameSaving}>
              {nameSaving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditingName(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {employee?.displayName ?? "Loading name…"}{" "}
          {employee ? (
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                setNameDraft(employee.displayName);
                setNameError(null);
                setEditingName(true);
              }}
            >
              Edit name
            </button>
          ) : null}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-[var(--surface)] px-2 py-1">
        <button
          type="button"
          className="min-h-11 min-w-11 rounded-full text-xl disabled:opacity-30"
          aria-label="Previous week"
          disabled={panelWeek <= thisMonday}
          onClick={() => goToWeek(format(addDays(parseISO(panelWeek), -7), "yyyy-MM-dd"))}
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {panelWeek === thisMonday ? "This week" : "Week"}
          </p>
          <p className="font-serif text-lg leading-tight">{formatWeekRange(panelWeek)}</p>
        </div>
        <button
          type="button"
          className="min-h-11 min-w-11 rounded-full text-xl"
          aria-label="Next week"
          onClick={() => goToWeek(format(addDays(parseISO(panelWeek), 7), "yyyy-MM-dd"))}
        >
          ›
        </button>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:items-start">
        <div>
          <MonthCalendar
            month={month}
            onMonth={(next) => {
              setMonth(startOfMonth(next));
              setSelected(null);
            }}
            selectedDate={selected}
            marks={marks}
            minDate={today}
            onSelectDate={(date) => {
              setSelected(date);
              setPickedWeek(mondayKey(date));
              setEditorSpot("calendar");
              revealEditor("calendar");
            }}
          />
          <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]" aria-label="Availability legend">
            {LEGEND.map((tone) => (
              <li key={tone} className="flex items-center gap-1.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    tone === "available" ? "bg-[#b7d7a8]" : tone === "limited" ? "bg-[#f3d56a]" : "bg-[#f4b7b8]"
                  }`}
                />
                {toneLabel(tone)}
              </li>
            ))}
          </ul>
        </div>
        <section ref={calendarEditorRef} className="card scroll-mt-4 p-4 shadow-none">
        <h2 className="text-lg">{selected ? format(parseISO(selected), "EEEE, MMMM d") : "Select a day"}</h2>
        {selected && selectedLocked ? (
          <p className="mt-2 text-sm text-[var(--muted)]">This week was approved by your manager, so it&apos;s locked.</p>
        ) : selected && editorSpot === "panel" ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Editing in the week section below.</p>
        ) : selected ? (
          <div className="mt-3">
            <AvailabilityEditor
              key={`${selected}-${selectedCell?.kind ?? "empty"}-${selectedCell?.note ?? ""}`}
              cell={selectedCell}
              saving={saving}
              onSave={(cell) => void saveDay(cell)}
              submitLabel="Confirm changes"
            />
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Tap a day, then choose Available all day, Choose times, or Sign off.
          </p>
        )}
        {error && editorSpot === "calendar" ? (
          <p role="alert" className="mt-3 text-sm text-[var(--conflict)]">
            {error}
          </p>
        ) : null}
        </section>
      </div>
      {today && user ? (
        <div className="mt-6">
          <h2 className="text-lg">Send your week to your manager</h2>
          <p className="mb-2 mt-1 text-sm text-[var(--muted)]">
            Set your days above, then send the week for approval. Use the arrows at the top to pick another week.
          </p>
          <WeekSubmitPanel
            key={panelWeek}
            weekStart={panelWeek}
            week={weeks[panelWeek]}
            employeeId={employeeId}
            uid={user.uid}
            name={employee?.displayName ?? user.displayName ?? user.email ?? "Staff"}
            today={today}
            request={mine.find((r) => r.weekStart === panelWeek) ?? null}
            onChanged={reloadRequests}
            selectedDate={selected}
            onSelectDay={(date) => {
              setSelected(date);
              setEditorSpot("panel");
              setError(null);
              revealEditor("panel");
            }}
            editor={
              selected && editorSpot === "panel" && mondayKey(selected) === panelWeek ? (
                <div ref={panelEditorRef} className="mt-4 scroll-mt-4 border-t border-[var(--border)] pt-4">
                  <p className="font-serif text-base">{format(parseISO(selected), "EEEE, MMMM d")}</p>
                  <div className="mt-3">
                    <AvailabilityEditor
                      key={`panel-${selected}-${selectedCell?.kind ?? "empty"}-${selectedCell?.note ?? ""}`}
                      formId="availability-week-form"
                      cell={selectedCell}
                      saving={saving}
                      onSave={(cell) => void saveDay(cell)}
                      submitLabel="Confirm changes"
                    />
                  </div>
                  {error ? (
                    <p role="alert" className="mt-3 text-sm text-[var(--conflict)]">
                      {error}
                    </p>
                  ) : null}
                </div>
              ) : null
            }
          />
        </div>
      ) : null}
    </PageFrame>
  );
}
