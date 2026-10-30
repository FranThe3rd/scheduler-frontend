"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { pageTransition } from "@/lib/motionPresets";

export function PageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)]">
      <AppHeader />
      <motion.main
        key={pathname}
        className="app-nav-pad mx-auto min-w-0 w-full max-w-7xl flex-1 px-4 pt-4 sm:px-6 lg:px-8"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={pageTransition}
      >
        {children}
      </motion.main>
    </div>
  );
}
