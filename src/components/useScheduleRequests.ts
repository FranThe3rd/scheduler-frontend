"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeRequests, type ScheduleRequest } from "@/lib/scheduleRequests";

/** Admin only: live list of schedule requests. */
export function useAdminRequests(): { requests: ScheduleRequest[] | null; error: string | null } {
  const { user, isAdmin, loading } = useAuth();
  const [requests, setRequests] = useState<ScheduleRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || !isAdmin) return;
    return subscribeRequests(
      (list) => {
        setRequests(list);
        setError(null);
      },
      () => setError("Could not load requests.")
    );
  }, [loading, user, isAdmin]);

  return { requests, error };
}
