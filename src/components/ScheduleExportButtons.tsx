"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Printer } from "lucide-react";
import type { Employee, Shift, WeekSchedule } from "@/lib/types";
import {
  buildScheduleTableMatrix,
  scheduleExportFilename,
} from "@/lib/scheduleGridTable";
import { formatWeekRange } from "@/lib/time";
import { downloadSchedulePdf } from "@/lib/exportSchedulePdf";
import { buildScheduleDocxBlob, downloadBlob } from "@/lib/exportScheduleDocx";

export function ScheduleExportButtons({
  week,
  employees,
  shifts,
  variant = "button",
}: {
  week: WeekSchedule;
  employees: Employee[];
  shifts?: Shift[];
  variant?: "button" | "link";
}) {
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const resolvedShifts = shifts ?? week.shifts;
  const title = "Bethlehem Dairy Store — Weekly Schedule";
  const subtitle = formatWeekRange(week.weekStart);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function exportPdf() {
    setOpen(false);
    setBusy("pdf");
    try {
      const { headers, body } = buildScheduleTableMatrix(week, employees, resolvedShifts);
      downloadSchedulePdf({
        title,
        subtitle,
        headers,
        body,
        filename: scheduleExportFilename(week.weekStart, "pdf"),
      });
    } finally {
      setBusy(null);
    }
  }

  async function exportDocx() {
    setOpen(false);
    setBusy("docx");
    try {
      const { headers, body } = buildScheduleTableMatrix(week, employees, resolvedShifts);
      const blob = await buildScheduleDocxBlob({ title, subtitle, headers, body });
      downloadBlob(blob, scheduleExportFilename(week.weekStart, "docx"));
    } finally {
      setBusy(null);
    }
  }

  const itemClass =
    "block w-full px-3 py-1.5 text-left text-[13px] hover:bg-[var(--accent-bg)] disabled:opacity-50";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={variant === "link" ? "inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)]" : "btn btn-ghost"}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy !== null}
        onClick={() => setOpen((o) => !o)}
      >
        {variant === "link" ? <Printer size={14} /> : null}
        {busy === "pdf" ? "Building PDF…" : busy === "docx" ? "Building DOCX…" : variant === "link" ? "Print / PDF" : "Export"}
        {variant === "button" ? <ChevronDown size={14} className="text-[var(--muted)]" /> : null}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-48 border border-[var(--border-strong)] bg-[var(--surface)] py-1 shadow-md"
        >
          <button type="button" role="menuitem" className={itemClass} onClick={() => void exportPdf()}>
            PDF table
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => void exportDocx()}>
            DOCX table
          </button>
        </div>
      ) : null}
    </div>
  );
}
