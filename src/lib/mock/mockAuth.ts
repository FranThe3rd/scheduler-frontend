import { adminEmails } from "../adminEmails";
import { readJson, removeKey, subscribeKey, writeJson } from "./localDb";

/** The bits of a signed-in account the app uses (shaped like the old Google user). */
export type MockUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
};

export type DemoRole = "admin" | "employee";

const USER_KEY = "current-user";

/** Pretend accounts — no passwords, no network. The employee is a seeded roster member. */
export const DEMO_ACCOUNTS: Record<DemoRole, MockUser> = {
  admin: {
    uid: "demo_manager",
    displayName: "Demo Manager",
    email: adminEmails()[0] ?? "manager@demo.local",
    emailVerified: true,
  },
  employee: {
    uid: "emp_jenn_stone",
    displayName: "Jenn Stone",
    email: "jenn.stone@demo.local",
    emailVerified: true,
  },
};

export function getMockUser(): MockUser | null {
  return readJson<MockUser | null>(USER_KEY, null);
}

export function signInMock(role: DemoRole): MockUser {
  const user = DEMO_ACCOUNTS[role];
  writeJson(USER_KEY, user);
  return user;
}

export function signOutMock(): void {
  removeKey(USER_KEY);
}

/** Fires when the signed-in account changes in this tab or another one. */
export function subscribeMockUser(onChange: (user: MockUser | null) => void): () => void {
  return subscribeKey(USER_KEY, () => onChange(getMockUser()));
}
