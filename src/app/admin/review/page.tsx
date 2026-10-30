"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, startOfMonth } from "date-fns";
import { Check, Clock, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useAdminRequests } from "@/components/useScheduleRequests";
import { PageFrame } from "@/components/PageFrame";
import { MonthCalendar } from "@/components/MonthCalendar";
import { useWeekBootstrap } from "@/components/useWeekBootstrap";
import { cellDetail, toneForCell } from "@/components/availabilityTone";
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
        availableAllWeek: 0,
        exceptions: [] as Array<{ id: string; name: string; summary: string; tone: "off" | "limited" | "unclear" }>,
      };
    }
    const dates = weekDates(weekStart);
    const active = data.employees.filter((employee) => employee.status === "active");
    const grouped = new Map<string, { name: string; off: string[]; limited: string[]; unclear: string[] }>();
    let signOffs = 0;
    let limited = 0;
    let availableAllWeek = 0;
    for (const employee of active) {
      const row = data.week.availability.find((item) => item.employeeId === employee.id);
      const name = employee.firstName?.trim() || employee.displayName;
      const bucket = { name, off: [] as string[], limited: [] as string[], unclear: [] as string[] };
      let everyDayAvailable = dates.length > 0;
      for (const date of dates) {
        const cell = row?.cells[date];
        const tone = toneForCell(cell);
        if (tone !== "available") everyDayAvailable = false;
        if (tone === "off") {
          signOffs += 1;
          bucket.off.push(format(parseISO(date), "EEE"));
        }
        if (tone === "limited") {
          limited += 1;
          bucket.limited.push(`${format(parseISO(date), "EEE")} ${cellDetail(cell)}`);
        }
        if (tone === "unclear") bucket.unclear.push(format(parseISO(date), "EEE"));
      }
      if (everyDayAvailable) availableAllWeek += 1;
      if (bucket.off.length || bucket.limited.length || bucket.unclear.length) grouped.set(employee.id, bucket);
    }
    const exceptions = [...grouped.entries()]
      .map(([id, bucket]) => {
        const parts: string[] = [];
        if (bucket.off.length) parts.push(`${bucket.off.join(" / ")} off`);
        if (bucket.limited.length) parts.push(bucket.limited.join(", "));
        if (bucket.unclear.length) parts.push(`${bucket.unclear.join(" / ")} unclear`);
        const tone: "off" | "limited" | "unclear" = bucket.off.length ? "off" : bucket.unclear.length ? "unclear" : "limited";
        return { id, name: bucket.name, summary: parts.join(" · "), tone };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { signOffs, limited, availableAllWeek, exceptions };
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
      {waiting > 0 ? (
        <Link
          href="/admin/requests"
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[#f6ead0] px-4 py-3 text-sm font-semibold text-[#6d5310]"
        >
          <span>
            {waiting} {waiting === 1 ? "week is" : "weeks are"} waiting for your approval
          </span>
          <span aria-hidden>Review →</span>
        </Link>
      ) : null}
      {error ? (
        <p role="alert" className="mb-3 text-sm text-[var(--conflict)]">
          {error}
        </p>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <div>
          <MonthCalendar
            month={month}
            onMonth={setMonth}
            weekStart={weekStart}
            onSelectDate={(date) => {
              const monday = format(mondayOf(date), "yyyy-MM-dd");
              setWeekStart(monday);
              setMonth(startOfMonth(parseISO(date)));
            }}
          />
        </div>
        <section className="card p-4 shadow-none sm:p-5">
          <h1 className="text-[1.85rem] leading-none">Hi, {adminName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Here&apos;s this week&apos;s overview.</p>
          {data && data.employees.filter((employee) => employee.status === "active").length === 0 ? (
            <p className="mt-3 rounded-2xl bg-[var(--surface-2)] px-3 py-3 text-sm">
              No staff yet. Employees show up here automatically after they sign in with Google.
            </p>
          ) : null}
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Selected week</p>
          <p className="font-serif text-[1.65rem] leading-tight">{weekStart ? formatWeekRange(weekStart) : "Loading the week…"}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <section className="stat-card bg-[var(--signoff)] text-[var(--signoff-fg)]">
              <UserRound size={16} />
              <p className="mt-2 text-xs sm:text-sm">Signed off</p>
              <p className="font-serif text-3xl leading-none">{summary.signOffs}</p>
            </section>
            <section className="stat-card bg-[var(--limited)] text-[var(--limited-fg)]">
              <Clock size={16} />
              <p className="mt-2 text-xs sm:text-sm">Limited hours</p>
              <p className="font-serif text-3xl leading-none">{summary.limited}</p>
            </section>
            <section className="stat-card bg-[var(--avail)] text-[var(--avail-fg)]">
              <Check size={16} />
              <p className="mt-2 text-xs sm:text-sm">Available all week</p>
              <p className="font-serif text-3xl leading-none">{summary.availableAllWeek}</p>
            </section>
          </div>
          <div className="mt-6">
          <h2 className="text-base">Notable availability this week</h2>
          {summary.exceptions.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">No sign-offs or limited hours recorded for this week.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {summary.exceptions.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-xl px-3 py-2.5 text-sm ${
                    item.tone === "off"
                      ? "bg-[var(--signoff)] text-[var(--signoff-fg)]"
                      : "bg-[var(--limited)] text-[var(--limited-fg)]"
                  }`}
                >
                  <span className="font-semibold">{item.name}</span>
                  <span> — {item.summary}</span>
                </li>
              ))}
            </ul>
          )}
          {data?.week.availabilityReviewed ? (
            <p className="mt-3 text-sm text-[var(--ok)]">This week is already marked reviewed.</p>
          ) : null}
          {notice ? <p className="mt-2 text-sm">{notice}</p> : null}
          <button
            type="button"
            className="btn btn-primary mt-4 h-12 w-full text-base"
            disabled={!data || saving}
            onClick={() => void viewAvailability()}
          >
            {saving ? "Saving…" : "Review availability →"}
          </button>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
