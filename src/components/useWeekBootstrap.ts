"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { StaffingStatusProp } from "@/lib/buildEligibility";
import type { AppSettings, Employee, WeekSchedule } from "@/lib/types";
import { useAdminWeek } from "@/components/useAdminWeek";
import { useAuth } from "@/components/AuthProvider";

export type WeekBootstrap = {
  employees: Employee[];
  week: WeekSchedule;
  settings: AppSettings;
  staffingStatus: StaffingStatusProp | null;
};

export function useWeekBootstrap() {
  const { rosterVersion, schedulerVersion } = useAuth();
  const [weekStart, setWeekStart] = useAdminWeek();
  const [data, setData] = useState<WeekBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<string | null>(null);

  const load = useCallback(async (week: string) => {
    const res = await apiFetch(`/api/bootstrap?week=${encodeURIComponent(week)}&mode=shell`);
    if (requestRef.current !== week) return;
    if (!res.ok) {
      setError("Could not load schedule.");
      return;
    }
    const json = await res.json();
    if (requestRef.current !== week) return;
    setError(null);
    setData({
      employees: json.employees ?? [],
      week: json.week,
      settings: json.settings,
      staffingStatus: json.staffingStatus ?? null,
    });
  }, []);

  useEffect(() => {
    if (!weekStart) return;
    const requested = weekStart;
    requestRef.current = requested;
    let cancelled = false;
    void apiFetch(`/api/bootstrap?week=${encodeURIComponent(requested)}&mode=shell`)
      .then(async (res) => {
        if (cancelled || requestRef.current !== requested) return;
        if (!res.ok) {
          setError("Could not load schedule.");
          return;
        }
        const json = await res.json();
        if (cancelled || requestRef.current !== requested) return;
        setError(null);
        setData({
          employees: json.employees ?? [],
          week: json.week,
          settings: json.settings,
          staffingStatus: json.staffingStatus ?? null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart, rosterVersion, schedulerVersion]);

  const reload = useCallback(() => {
    if (!weekStart) return;
    requestRef.current = weekStart;
    void load(weekStart);
  }, [weekStart, load]);

  return {
    weekStart,
    setWeekStart,
    data,
    error,
    reload,
  };
}
