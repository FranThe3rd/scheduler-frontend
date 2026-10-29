"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isAdminEmail } from "@/lib/adminEmails";
import { getMockAppData } from "@/lib/mock/store";
import { ensureOwnEmployee, loadMockState, subscribeMockState } from "@/lib/mock/persistence";
import {
  getMockUser,
  signInMock,
  signOutMock,
  subscribeMockUser,
  type DemoRole,
  type MockUser,
} from "@/lib/mock/mockAuth";

type AuthContextValue = {
  user: MockUser | null;
  /** True until the saved demo account and data have loaded. */
  loading: boolean;
  isAdmin: boolean;
  /** This account's roster employee id, once their record exists. */
  employeeId: string | null;
  /** Sign in as one of the demo accounts. */
  signIn: (role: DemoRole) => Promise<MockUser>;
  signOut: () => Promise<void>;
  /** Bumps when staff data changes in another tab; pages reload when it changes. */
  rosterVersion: number;
  /** Bumps when saved weeks/settings change in another tab. */
  schedulerVersion: number;
  /** Create this account's employee record if missing. */
  ensureEmployee: () => Promise<void>;
};

function userIsAdmin(user: MockUser | null): boolean {
  return !!user && user.emailVerified && isAdminEmail(user.email);
}

function rosterIdFor(user: MockUser | null): string | null {
  if (!user) return null;
  return getMockAppData().employees.some((e) => e.id === user.uid) ? user.uid : null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [rosterVersion, setRosterVersion] = useState(0);
  const [schedulerVersion, setSchedulerVersion] = useState(0);

  useEffect(() => {
    const load = (next: MockUser | null) => {
      loadMockState();
      setUser(next);
      setEmployeeId(rosterIdFor(next));
      setLoading(false);
    };
    load(getMockUser());
    return subscribeMockUser(load);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    return subscribeMockState(() => {
      setEmployeeId(rosterIdFor(user));
      setRosterVersion((version) => version + 1);
      setSchedulerVersion((version) => version + 1);
    });
  }, [loading, user]);

  const signIn = useCallback(async (role: DemoRole) => signInMock(role), []);

  const signOut = useCallback(async () => {
    signOutMock();
  }, []);

  const ensureEmployee = useCallback(async () => {
    if (!user) return;
    ensureOwnEmployee(user);
    setEmployeeId(user.uid);
  }, [user]);

  const isAdmin = userIsAdmin(user);
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin,
      employeeId,
      rosterVersion,
      schedulerVersion,
      signIn,
      signOut,
      ensureEmployee,
    }),
    [user, loading, isAdmin, employeeId, rosterVersion, schedulerVersion, signIn, signOut, ensureEmployee]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
