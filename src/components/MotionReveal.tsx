"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fadeUp, pageTransition, staggerChildren } from "@/lib/motionPresets";

type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
};

/** Subtle enter animation for sections and cards. Respects reduced motion. */
export function MotionReveal({ stagger, children, className }: MotionRevealProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={stagger ? staggerChildren : fadeUp}
      initial="hidden"
      animate="show"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div variants={fadeUp} transition={pageTransition} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <ul className={className}>{children}</ul>;
  return (
    <motion.ul className={className} variants={staggerChildren} initial="hidden" animate="show">
      {children}
    </motion.ul>
  );
}
