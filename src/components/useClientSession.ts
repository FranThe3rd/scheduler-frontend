"use client";

import { useSyncExternalStore } from "react";
import { useAuth } from "@/components/AuthProvider";
import { thisWeekMondayNy, todayInNewYork } from "@/lib/time";

function emptySubscribe() {
  return () => {};
}

/** Roster employee linked to the signed-in Google account. */
export function useEmployeeId(): string | null {
  return useAuth().employeeId;
}

export function useThisWeekMonday(): string | null {
  return useSyncExternalStore(emptySubscribe, thisWeekMondayNy, () => null);
}

/** Today's date (YYYY-MM-DD, New York); null during server render. */
export function useToday(): string | null {
  return useSyncExternalStore(emptySubscribe, todayInNewYork, () => null);
}
