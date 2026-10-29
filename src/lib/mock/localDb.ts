/**
 * Tiny browser-only persistence for the mock app: JSON values in localStorage, with change
 * listeners in this tab and across tabs (via the `storage` event). Outside the browser
 * (tests, SSR) values live in memory only.
 */
const PREFIX = "dairy-store-mock:";

const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function notify(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener();
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = storage()?.getItem(PREFIX + key) ?? memory.get(key) ?? null;
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  const store = storage();
  if (store) {
    try {
      store.setItem(PREFIX + key, raw);
    } catch (error) {
      console.warn("[mock-db] Could not save to localStorage.", error);
      memory.set(key, raw);
    }
  } else {
    memory.set(key, raw);
  }
  notify(key);
}

export function removeKey(key: string): void {
  storage()?.removeItem(PREFIX + key);
  memory.delete(key);
  notify(key);
}

/** Calls `onChange` whenever `key` is written in this tab or another tab. */
export function subscribeKey(key: string, onChange: () => void): () => void {
  const set = listeners.get(key) ?? new Set();
  set.add(onChange);
  listeners.set(key, set);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PREFIX + key) onChange();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    set.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Wipe every mock value (used by "Reset demo data"). */
export function clearAll(): void {
  const store = storage();
  if (store) {
    for (const key of Object.keys(store)) {
      if (key.startsWith(PREFIX)) store.removeItem(key);
    }
  }
  memory.clear();
  for (const key of listeners.keys()) notify(key);
}
