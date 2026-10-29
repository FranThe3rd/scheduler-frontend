"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, startOfMonth } from "date-fns";
import { Clock, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useAdminRequests } from "@/components/useScheduleRequests";
import { PageFrame } from "@/components/PageFrame";
import { MonthCalendar } from "@/components/MonthCalendar";
import { useWeekBootstrap } from "@/components/useWeekBootstrap";
import { cellDetail, toneForCell, toneLabel } from "@/components/availabilityTone";
import { apiFetch } from "@/lib/api/client";
import { formatWeekRange, mondayOf, weekDates } from "@/lib/time";

export default function ReviewAvailabilityPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { requests } = useAdminRequests();
  const waiting = requests?.filter((r) => r.status === "pending").length ?? 0;
  const adminName = user?.displayName?.split(/\s+/)[0] ?? "there";
  const { weekStart, setWeekStart, data, error, reload } = useWeekBootstrap();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const summary = useMemo(() => {
    if (!data || !weekStart) {
      return {
        signOffs: 0,
        limited: 0,
        exceptions: [] as Array<{ id: string; name: string; date: string; detail: string; tone: string }>,
      };
    }
    const dates = new Set(weekDates(weekStart));
    const active = data.employees.filter((employee) => employee.status === "active");
    const exceptions: Array<{ id: string; name: string; date: string; detail: string; tone: string }> = [];
    let signOffs = 0;
    let limited = 0;
    for (const employee of active) {
      const row = data.week.availability.find((item) => item.employeeId === employee.id);
      for (const date of dates) {
        const cell = row?.cells[date];
        const tone = toneForCell(cell);
        if (tone === "off") signOffs += 1;
        if (tone === "limited") limited += 1;
        if (tone === "off" || tone === "limited" || tone === "unclear") {
          exceptions.push({
            id: `${employee.id}-${date}`,
            name: employee.firstName?.trim() || employee.displayName,
            date,
            detail: cellDetail(cell),
            tone: toneLabel(tone),
          });
        }
      }
    }
    exceptions.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
    return { signOffs, limited, exceptions };
  }, [data, weekStart]);

  async function viewAvailability() {
    if (!weekStart) return;
    setSaving(true);
    setNotice(null);
    const res = await apiFetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, action: "mark_reviewed" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setNotice(json.error || "Could not mark availability reviewed.");
      setSaving(false);
      return;
    }
    reload();
    router.push("/admin/generate");
  }

  return (
    <PageFrame>
      <h1 className="text-[1.75rem] leading-none sm:text-[2rem]">Hi, {adminName}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Step 1 of 3 · See who signed off or has limited hours this week. Tap a date to change the week.
      </p>
      {waiting > 0 ? (
        <Link
          href="/admin/requests"
          className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#f6ead0] px-4 py-3 text-sm font-semibold text-[#6d5310]"
        >
          <span>
            {waiting} {waiting === 1 ? "week is" : "weeks are"} waiting for your approval
          </span>
          <span aria-hidden>Review →</span>
        </Link>
      ) : null}
      {data && data.employees.filter((employee) => employee.status === "active").length === 0 ? (
        <p className="mt-3 rounded-2xl bg-[var(--surface)] px-3 py-3 text-sm">
          No staff yet. Employees show up here automatically after they sign in with Google.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--conflict)]">
          {error}
        </p>
      ) : null}
      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <MonthCalendar
          compact
          month={month}
          onMonth={setMonth}
          weekStart={weekStart}
          onSelectDate={(date) => {
            const monday = format(mondayOf(date), "yyyy-MM-dd");
            setWeekStart(monday);
            setMonth(startOfMonth(parseISO(date)));
          }}
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Selected week</p>
          <p className="font-serif text-lg">{weekStart ? formatWeekRange(weekStart) : "Loading the week…"}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <section className="rounded-2xl bg-[#f7d6d4] px-3 py-3">
              <UserRound size={16} className="text-[#8d3d45]" />
              <p className="mt-2 text-sm text-[#8d3d45]">Signed off</p>
              <p className="font-serif text-3xl leading-none">{summary.signOffs}</p>
            </section>
            <section className="rounded-2xl bg-[#f6ead0] px-3 py-3">
              <Clock size={16} className="text-[#8a6a20]" />
              <p className="mt-2 text-sm text-[#8a6a20]">Limited hours</p>
              <p className="font-serif text-3xl leading-none">{summary.limited}</p>
            </section>
          </div>
        </div>
      </div>
      <section className="mt-4">
        <h2 className="text-base">Notable availability this week</h2>
        {summary.exceptions.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No sign-offs or limited hours recorded for this week.</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {summary.exceptions.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface)] px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-[var(--muted)]"> {format(parseISO(item.date), "EEE")} · {item.tone}</span>
                </span>
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    item.tone === "Sign off" ? "bg-[#f4b7b8]" : "bg-[#f3d56a]"
                  }`}
                  aria-hidden
                />
              </li>
            ))}
          </ul>
        )}
        {data?.week.availabilityReviewed ? (
          <p className="mt-2 text-center text-sm text-[var(--ok)]">This week is already marked reviewed.</p>
        ) : null}
        {notice ? <p className="mt-2 text-center text-sm">{notice}</p> : null}
        <button
          type="button"
          className="btn btn-primary mt-4 h-12 w-full rounded-full text-base md:w-auto md:min-w-64"
          disabled={!data || saving}
          onClick={() => void viewAvailability()}
        >
          {saving ? "Saving…" : "View availability →"}
        </button>
      </section>
    </PageFrame>
  );
}
