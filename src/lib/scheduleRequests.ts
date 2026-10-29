import { readJson, subscribeKey, writeJson } from "./mock/localDb";
import type { Department, LocationCode } from "./types";

/**
 * Staff send the availability they set for a week to the admin, who approves or declines it.
 * One submission per person per week (id `${uid}_${weekStart}`), saved in this browser.
 * The availability itself is saved with the employee record; this is the "I'm done, approve it" step.
 */
const KEY = "schedule-requests";

export type RequestStatus = "pending" | "approved" | "declined";

export type RequestDay = {
  tone: "available" | "limited" | "off";
  text: string;
  /** Employee's preferred working window for this day. */
  startMinutes?: number;
  endMinutes?: number;
};

export type AssignedShift = {
  date: string;
  startMinutes: number;
  endMinutes: number;
  location: Exclude<LocationCode, "unknown">;
  department: Department;
};

export type ScheduleRequest = {
  id: string;
  uid: string;
  name: string;
  weekStart: string;
  /** date (YYYY-MM-DD) -> how the employee marked that day. Days left unset are omitted. */
  days: Record<string, RequestDay>;
  status: RequestStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  assignedShifts: AssignedShift[];
  /** Legacy single-shift field. */
  assignedShift?: AssignedShift;
};

type Store = Record<string, ScheduleRequest>;

const read = (): Store => readJson<Store>(KEY, {});
const write = (store: Store) => writeJson(KEY, store);

export function requestId(uid: string, weekStart: string): string {
  return `${uid}_${weekStart}`;
}

function sortRequests(list: ScheduleRequest[]): ScheduleRequest[] {
  const rank: Record<RequestStatus, number> = { pending: 0, approved: 1, declined: 2 };
  return [...list].sort(
    (a, b) => rank[a.status] - rank[b.status] || a.weekStart.localeCompare(b.weekStart) || a.name.localeCompare(b.name)
  );
}

function mine(uid: string): ScheduleRequest[] {
  return sortRequests(Object.values(read()).filter((request) => request.uid === uid));
}

/** Deliver the current list now (async, like a live query) and again on every change. */
function live(get: () => ScheduleRequest[], onData: (requests: ScheduleRequest[]) => void): () => void {
  let active = true;
  queueMicrotask(() => {
    if (active) onData(get());
  });
  const unsubscribe = subscribeKey(KEY, () => onData(get()));
  return () => {
    active = false;
    unsubscribe();
  };
}

export async function listMyRequests(uid: string): Promise<ScheduleRequest[]> {
  return mine(uid);
}

/** Employee: live status updates, including the shift assigned on approval. */
export function subscribeMyRequests(
  uid: string,
  onData: (requests: ScheduleRequest[]) => void,
  _onError?: (error: unknown) => void
): () => void {
  return live(() => mine(uid), onData);
}

export async function submitRequest(args: {
  uid: string;
  name: string;
  weekStart: string;
  days: Record<string, RequestDay>;
}): Promise<void> {
  const id = requestId(args.uid, args.weekStart);
  write({
    ...read(),
    [id]: {
      id,
      uid: args.uid,
      name: args.name,
      weekStart: args.weekStart,
      days: args.days,
      status: "pending",
      createdAt: new Date().toISOString(),
      assignedShifts: [],
    },
  });
}

export async function withdrawRequest(id: string): Promise<void> {
  const store = read();
  delete store[id];
  write(store);
}

/** Admin: permanently delete one approval record. */
export async function deleteScheduleRequest(id: string): Promise<void> {
  await withdrawRequest(id);
}

/** Admin: permanently remove every request/approval owned by an employee. */
export async function deleteRequestsForUser(uid: string): Promise<void> {
  write(Object.fromEntries(Object.entries(read()).filter(([, request]) => request.uid !== uid)));
}

/** Admin: approve with a concrete shift, decline, or set back to pending. */
export async function decideRequest(
  id: string,
  status: RequestStatus,
  adminEmail: string,
  assignedShifts?: AssignedShift[]
): Promise<void> {
  if (status === "approved") {
    if (!assignedShifts?.length) throw new Error("At least one shift is required before approval.");
    if (new Set(assignedShifts.map((shift) => shift.date)).size !== assignedShifts.length) {
      throw new Error("Only one shift can be assigned per selected day.");
    }
    if (assignedShifts.some((shift) => shift.endMinutes <= shift.startMinutes)) {
      throw new Error("Every shift end time must be after its start time.");
    }
  }
  const store = read();
  const current = store[id];
  if (!current) throw new Error("This request no longer exists.");
  store[id] =
    status === "pending"
      ? { ...current, status, decidedAt: undefined, decidedBy: undefined, assignedShift: undefined, assignedShifts: [] }
      : {
          ...current,
          status,
          decidedAt: new Date().toISOString(),
          decidedBy: adminEmail,
          assignedShift: undefined,
          assignedShifts: status === "approved" ? assignedShifts! : [],
        };
  write(store);
}

/** Admin: live list of every request. */
export function subscribeRequests(
  onData: (requests: ScheduleRequest[]) => void,
  _onError?: (error: unknown) => void
): () => void {
  return live(() => sortRequests(Object.values(read())), onData);
}

/** Plain-language reason a request action failed. */
export function requestErrorMessage(error: unknown): string {
  console.warn("[requests] error", error);
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
