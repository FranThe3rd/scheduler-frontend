import { handleMockRequest } from "../mock/handlers";
import { persistMockState } from "../mock/persistence";
import { getMockAppData } from "../mock/store";
import { getMockUser } from "../mock/mockAuth";
import { syncPublishedAssignmentsFromWeek } from "../publishedSchedules";

/** Local domain API: every request is answered by the in-browser mock and saved to localStorage. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === "string"
      ? new URL(input, typeof window !== "undefined" ? window.location.origin : "http://local")
      : input instanceof URL
        ? input
        : new URL(input.url);

  const method = (init?.method ?? "GET").toUpperCase();
  const result = handleMockRequest(url.pathname, method, init?.body ?? null, url.searchParams);

  if (method !== "GET" && result.status < 400) {
    persistMockState();
    if (url.pathname === "/api/schedule" && typeof init?.body === "string") {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      const weekStart = String(body.weekStart ?? "");
      const data = getMockAppData();
      const week = data.weeks.find((item) => item.weekStart === weekStart);
      if (week) {
        syncPublishedAssignmentsFromWeek({
          weekStart,
          employees: data.employees,
          shifts: week.shifts,
          approvedBy: getMockUser()?.email ?? "",
          publishAll: true,
        });
      }
    }
  }

  if ("text" in result) {
    return new Response(result.text, {
      status: result.status,
      headers: { "Content-Type": result.contentType },
    });
  }

  return new Response(JSON.stringify(result.json), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}
