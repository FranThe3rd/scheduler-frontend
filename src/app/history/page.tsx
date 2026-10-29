"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/components/AuthProvider";
import type { HistoricalWeek } from "@/lib/types";
import { apiFetch } from "@/lib/api/client";

export default function HistoryPage() {
  const { schedulerVersion } = useAuth();
  const [history, setHistory] = useState<HistoricalWeek[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [label, setLabel] = useState("Manual history entry");

  const reload = useCallback(async () => {
    const res = await apiFetch("/api/settings");
    const json = await res.json();
    setHistory(json.history ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await apiFetch("/api/settings");
      const json = await res.json();
      if (!cancelled) setHistory(json.history ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [schedulerVersion]);

  async function addWeek() {
    if (!weekStart) return;
    const end = new Date(weekStart + "T12:00:00");
    end.setDate(end.getDate() + 6);
    const weekEnd = end.toISOString().slice(0, 10);
    await apiFetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_history_week",
        week: {
          weekStart,
          weekEnd,
          yearConfirmed: false,
          status: "draft",
          sourceLabel: label,
          notes: [
            "Manual entry — do not fabricate shifts from DNA summaries.",
            "Mark authoritative after review if this week has duplicates.",
          ],
        },
      }),
    });
    setWeekStart("");
    await reload();
  }

  async function setAuthoritative(weekId: string) {
    await apiFetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_authoritative", weekId }),
    });
    await reload();
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="app-nav-pad mx-auto max-w-3xl space-y-3 px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">History &amp; imports</h1>
        <p className="text-sm text-[var(--muted)]">
          Historical schedules teach soft DNA patterns. Availability calendars are a different
          document type. Duplicate weeks (e.g. Sep 21–27) count once after you mark the
          authoritative version. Unapproved generated drafts are never learned from.
        </p>

        <div className="card space-y-2 p-4">
          <h2 className="font-semibold">Add a historical week manually</h2>
          <input
            type="date"
            className="w-full input"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          />
          <input
            className="w-full input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Source label"
          />
          <button type="button" className="btn btn-primary" onClick={() => void addWeek()}>
            Add week
          </button>
          <p className="text-xs text-[var(--muted)]">
            Demonstration / DNA summary records are labeled separately and do not invent individual
            shift rows.
          </p>
        </div>

        <div className="space-y-2">
          {history.map((h) => (
            <article key={h.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    {h.weekStart} → {h.weekEnd}
                  </h3>
                  <p className="text-sm text-[var(--muted)]">{h.sourceLabel}</p>
                </div>
                <div className="text-xs font-semibold text-[var(--muted)]">
                  {h.status}
                  {h.authoritative ? " · authoritative" : ""}
                  {!h.yearConfirmed ? " · year unconfirmed" : ""}
                </div>
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm text-[var(--muted)]">
                {h.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm">
                {h.shifts.length} stored shift row{h.shifts.length === 1 ? "" : "s"}
                {h.duplicateGroup ? ` · duplicate group: ${h.duplicateGroup}` : ""}
              </p>
              {!h.authoritative && (
                <button
                  type="button"
                  className="btn btn-ghost mt-3"
                  onClick={() => void setAuthoritative(h.id)}
                >
                  Mark authoritative
                </button>
              )}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
