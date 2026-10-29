import { buildSeedEmployees } from "../seed/employees";
import { createEmployee } from "../createEmployee";
import type { AppData, Employee, WeekSchedule } from "../types";
import { getMockAppData, resetMockStore, setMockRoster, syncWeek } from "./store";
import { readJson, subscribeKey, writeJson } from "./localDb";

/**
 * The whole mock app (roster, weeks, availability, settings) is saved to localStorage so it
 * survives reloads and stays in sync between tabs. First visit starts from the seed roster.
 */
const STATE_KEY = "app-state";

let lastSerialized: string | null = null;

/** Coverage, issues and totals are rebuilt from shifts + availability on load. */
function slimWeek(week: WeekSchedule): WeekSchedule {
  return { ...week, issues: [], coverage: [], totals: [] };
}

function serialize(data: AppData): string {
  return JSON.stringify({
    ...data,
    weeks: data.weeks.map(slimWeek),
    savedSessions: (data.savedSessions ?? []).map((session) => ({ ...session, week: slimWeek(session.week) })),
  } satisfies AppData);
}

function apply(saved: AppData): void {
  const data = getMockAppData();
  Object.assign(data, saved);
  data.savedSessions = saved.savedSessions ?? [];
  for (const week of data.weeks) syncWeek(data, week);
}

/** Reset the in-memory store and load the saved state (or the seed roster on first visit). */
export function loadMockState(): void {
  resetMockStore();
  const saved = readJson<AppData | null>(STATE_KEY, null);
  if (saved?.employees) {
    apply(saved);
  } else {
    setMockRoster(buildSeedEmployees(), { pruneUnknownEmployees: true });
    persistMockState();
  }
  lastSerialized = serialize(getMockAppData());
}

export function persistMockState(): void {
  const serialized = serialize(getMockAppData());
  if (serialized === lastSerialized) return;
  lastSerialized = serialized;
  writeJson(STATE_KEY, JSON.parse(serialized));
}

/** Pick up changes saved by another tab. */
export function subscribeMockState(onChange: () => void): () => void {
  return subscribeKey(STATE_KEY, () => {
    const saved = readJson<AppData | null>(STATE_KEY, null);
    if (!saved?.employees) return;
    const serialized = JSON.stringify(saved);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    apply(saved);
    onChange();
  });
}

/** Make sure the signed-in demo account has an employee record. */
export function ensureOwnEmployee(user: { uid: string; displayName: string | null; email: string | null }): Employee {
  const data = getMockAppData();
  const existing = data.employees.find((e) => e.id === user.uid);
  if (existing) return existing;
  const name = user.displayName?.trim() || user.email?.split("@")[0] || "New staff";
  const employee: Employee = {
    ...createEmployee({ displayName: name, colorIndex: data.employees.length }),
    id: user.uid,
    email: user.email ?? undefined,
  };
  setMockRoster([...data.employees, employee], { pruneUnknownEmployees: false });
  persistMockState();
  return employee;
}
