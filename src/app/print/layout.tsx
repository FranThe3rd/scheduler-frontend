import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard";

// Staff can open the team schedule from "My schedule", so any signed-in user may view it.
export default function Layout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
