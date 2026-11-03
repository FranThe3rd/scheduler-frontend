"use client";

import { useEffect, type RefObject } from "react";

/**
 * Marks the table head while its day row is pinned, so the phone CSS can hang a
 * waffle strip above it. Names that already scrolled past would otherwise show
 * through Safari's see-through top bar.
 */
export function WaffleScrollCover({ anchorRef }: { anchorRef: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const table = anchorRef.current?.closest("table");
      if (!table) return;
      const rect = table.getBoundingClientRect();
      const pinned = rect.top < -1 && rect.bottom > 0;
      anchorRef.current?.classList.toggle("is-pinned", pinned);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      anchorRef.current?.classList.remove("is-pinned");
    };
  }, [anchorRef]);

  return null;
}
