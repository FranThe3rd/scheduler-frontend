"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/components/AuthProvider";
import type { AppSettings, StaffingIntervalTarget } from "@/lib/types";
import { minutesToLabel } from "@/lib/time";
import { apiFetch } from "@/lib/api/client";

type ProposalSource = {
  label: string;
  count: number;
  days: string;
  sources: string[];
};

type StaffingStatus = {
  lindenConfirmed: boolean;
  lehighConfirmed: boolean;
  lindenCount: number;
  lehighCount: number;
  bothConfirmed: boolean;
};

export default function SettingsPage() {
  const { schedulerVersion } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [targets, setTargets] = useState<StaffingIntervalTarget[]>([]);
  const [status, setStatus] = useState<StaffingStatus | null>(null);
  const [lehighSources, setLehighSources] = useState<ProposalSource[]>([]);
  const [saved, setSaved] = useState(false);
  const [dayFilter, setDayFilter] = useState<string>("friday");
  const [locTab, setLocTab] = useState<"linden" | "lehigh">("linden");

  useEffect(() => {
    void apiFetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        setSettings(j.settings);
        setTargets(j.staffingTargets ?? []);
        setStatus(j.staffingStatus ?? null);
        setLehighSources(j.lehighProposalSources ?? []);
      });
  }, [schedulerVersion]);

  const visibleTargets = useMemo(
    () =>
      targets.filter(
        (t) =>
          t.location === locTab && (dayFilter === "all" || t.day === dayFilter)
      ),
    [targets, dayFilter, locTab]
  );

  async function saveSettings(next: Partial<AppSettings>) {
    const res = await apiFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: next }),
    });
    const json = await res.json();
    setSettings(json.settings);
    setSaved(true);
  }

  async function saveTargets(next: StaffingIntervalTarget[]) {
    const res = await apiFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffingTargets: next }),
    });
    const json = await res.json();
    setSettings(json.settings);
    setTargets(json.staffingTargets);
    setStatus(json.staffingStatus ?? null);
    setSaved(true);
  }

  function setCount(id: string, count: number) {
    const n = Math.max(0, Math.min(20, Math.round(count)));
    setTargets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, minimum: n, desired: n } : t))
    );
  }

  async function confirmLocation(location: "linden" | "lehigh") {
    const label = location === "linden" ? "Linden" : "Lehigh";
    if (
      !confirm(
        `Confirm and enable ${label} coverage targets?\n\n` +
          (location === "lehigh"
            ? "Lehigh blocks were proposed from historical L-marked assignments — review counts and sources first.\n"
            : "Linden headcounts stay as edited.\n") +
          "The other store’s confirmation is unchanged."
      )
    ) {
      return;
    }
    const res = await apiFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        location === "linden"
          ? { confirmLindenTargets: true }
          : { confirmLehighTargets: true }
      ),
    });
    const json = await res.json();
    setSettings(json.settings);
    setTargets(json.staffingTargets);
    setStatus(json.staffingStatus ?? null);
    setLehighSources(json.lehighProposalSources ?? []);
    setSaved(true);
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="app-nav-pad mx-auto max-w-3xl space-y-3 px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Staffing &amp; settings</h1>
        <p className="text-sm text-[var(--muted)]">
          Confirm reusable coverage targets for Linden and Lehigh separately. Opening/closing
          qualifications are not inferred from age, roster order, or closing-shift history.
        </p>

        {settings && (
          <div className="card space-y-4 p-4">
            <h2 className="font-semibold">Location convention</h2>
            <p className="text-sm text-[var(--muted)]">
              L means Lehigh. There is no UL code. Whether unmarked historical shifts mean Linden is
              still unconfirmed.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.locationConventionConfirmed}
                onChange={(e) =>
                  void saveSettings({ locationConventionConfirmed: e.target.checked })
                }
              />
              I have confirmed how unmarked shifts should be treated
            </label>
            <select
              className="input"
              value={
                settings.unmarkedMeansLinden === null
                  ? ""
                  : settings.unmarkedMeansLinden
                    ? "linden"
                    : "unknown"
              }
              onChange={(e) => {
                const v = e.target.value;
                void saveSettings({
                  unmarkedMeansLinden: v === "" ? null : v === "linden",
                });
              }}
            >
              <option value="">Still unconfirmed</option>
              <option value="linden">Unmarked means Linden</option>
              <option value="unknown">Keep unmarked as unknown</option>
            </select>
          </div>
        )}

        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">Coverage targets</h2>
          <p className="text-sm text-[var(--muted)]">
            Edit headcounts (one number per block), then confirm each store. Build requires both
            Linden and Lehigh confirmed.
          </p>
          {status && (
            <p className="text-sm">
              Linden: {status.lindenConfirmed ? `confirmed (${status.lindenCount})` : "not confirmed"}
              {" · "}
              Lehigh: {status.lehighConfirmed ? `confirmed (${status.lehighCount})` : "not confirmed"}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn ${locTab === "linden" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setLocTab("linden")}
            >
              Linden
            </button>
            <button
              type="button"
              className={`btn ${locTab === "lehigh" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setLocTab("lehigh")}
            >
              Lehigh
            </button>
          </div>

          {locTab === "lehigh" && lehighSources.length > 0 && (
            <div className="border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm">
              <p className="font-semibold">Proposed from historical L-marked assignments</p>
              <ul className="mt-2 space-y-2 text-[var(--muted)]">
                {lehighSources.map((p) => (
                  <li key={p.label}>
                    <span className="font-medium text-[var(--text)]">
                      {p.label} · need {p.count} · {p.days}
                    </span>
                    <ul className="ml-4 list-disc">
                      {p.sources.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                These are proposals for review — not auto-copied from Linden. Edit counts before
                confirming.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            Day
            <select
              className="input !w-auto"
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
            >
              <option value="all">All days</option>
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
              <option value="saturday">Saturday</option>
              <option value="sunday">Sunday</option>
            </select>
          </label>

          <div className="space-y-1.5">
            {visibleTargets.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                No {locTab} targets for this day filter. Choose “All days” or add counts after
                confirming proposals.
              </p>
            )}
            {visibleTargets.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                <span className="min-w-[10rem]">
                  {t.day} {minutesToLabel(t.startMinutes)}–{minutesToLabel(t.endMinutes)}
                  {t.confirmed && t.enabled ? (
                    <span className="ml-2 text-[var(--ok)]">on</span>
                  ) : (
                    <span className="ml-2 text-[var(--muted)]">off</span>
                  )}
                </span>
                <label className="flex items-center gap-2">
                  Need
                  <input
                    type="number"
                    min={0}
                    max={20}
                    className="input !w-16 text-right font-semibold"
                    value={t.desired}
                    onChange={(e) => setCount(t.id, Number(e.target.value))}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveTargets(targets)}
            >
              Save target edits
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void confirmLocation(locTab)}
            >
              Confirm {locTab === "linden" ? "Linden" : "Lehigh"} targets
            </button>
          </div>
          {saved && <p className="text-sm text-[var(--ok)]">Saved.</p>}
        </div>

        <div className="card p-4 text-sm text-[var(--muted)]">
          Opening/closing role eligibility is empty until Mike assigns confirmed qualifications on
          employee profiles. Historical 10 PM endings do not prove closing authority.
        </div>
      </main>
    </div>
  );
}
