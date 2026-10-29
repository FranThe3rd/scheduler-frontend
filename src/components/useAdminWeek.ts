"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useThisWeekMonday } from "@/components/useClientSession";

/**
 * The week the manager is working on, shared by the Overview, Availability and
 * Schedule tabs so picking a week once carries through the whole flow.
 * Lives in memory only — a full reload goes back to the current week.
 */
let selectedWeek: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return selectedWeek;
}

function getServerSnapshot() {
  return null;
}

export function useAdminWeek(): [string | null, (week: string) => void] {
  const seeded = useThisWeekMonday();
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setWeek = useCallback((week: string) => {
    if (selectedWeek === week) return;
    selectedWeek = week;
    listeners.forEach((listener) => listener());
  }, []);
  return [stored ?? seeded, setWeek];
}
