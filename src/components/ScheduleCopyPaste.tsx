"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import type { WeekSchedule } from "@/lib/types";
import { apiFetch } from "@/lib/api/client";
import {
  CLIPBOARD_STORAGE_KEY,
  clipboardSummary,
  readClipboard,
  type WeekClipboard,
  weekClipboardFromShifts,
  writeClipboard,
} from "@/lib/scheduleClipboard";
import { formatWeekRange } from "@/lib/time";

let cachedRaw: string | null | undefined;
let cachedClip: WeekClipboard | null = null;

function clipboardSnapshot(): WeekClipboard | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CLIPBOARD_STORAGE_KEY);
  if (raw === cachedRaw) return cachedClip;
  cachedRaw = raw;
  cachedClip = readClipboard();
  return cachedClip;
}

function emptySubscribe() {
  return () => {};
}

/** Toolbar controls for copying a week and pasting it into another week. */
export function ScheduleCopyPaste({
  weekStart,
  week,
  onApplied,
  appearance = "toolbar",
}: {
  weekStart: string;
  week: WeekSchedule;
  onApplied: () => void;
  appearance?: "toolbar" | "link";
}) {
  const stored = useSyncExternalStore(emptySubscribe, clipboardSnapshot, () => null);
  const [override, setClip] = useState<WeekClipboard | null | undefined>(undefined);
  const clip = override === undefined ? stored : override;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const summary = clipboardSummary(clip);

  const copyWeek = useCallback(() => {
    const next = weekClipboardFromShifts(weekStart, week.shifts);
    writeClipboard(next);
    setClip(next);
    setMessage(`Copied ${formatWeekRange(weekStart)} (${next.items.length} shifts).`);
  }, [week, weekStart]);

  const pasteWeek = useCallback(async () => {
    if (!clip) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart,
          action: "paste_week",
          items: clip.items,
        }),
      });
      const json = (await res.json()) as { error?: string; pasted?: number };
      if (!res.ok) throw new Error(json.error ?? "Paste failed");
      setMessage(`Pasted ${json.pasted ?? clip.items.length} shifts into ${formatWeekRange(weekStart)}.`);
      onApplied();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Paste failed");
    } finally {
      setBusy(false);
    }
  }, [clip, weekStart, onApplied]);

  function clearClipboard() {
    writeClipboard(null);
    setClip(null);
    setMessage("Clipboard cleared.");
  }

  const statusText = message ?? (summary ? `Clipboard: ${summary}` : null);

  if (appearance === "link") {
    return (
      <div className="flex items-center gap-3 text-sm">
        <button type="button" className="font-semibold text-[var(--muted)]" disabled={busy} onClick={() => copyWeek()}>
          Copy to…
        </button>
        <button type="button" className="font-semibold text-[var(--muted)]" disabled={busy || !clip} onClick={() => void pasteWeek()}>
          {busy ? "Pasting…" : "Paste"}
        </button>
        {statusText ? (
          <span role="status" className="truncate text-xs text-[var(--muted)]">
            {statusText}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {statusText ? (
        <span
          role="status"
          className="max-w-[22rem] truncate text-[12px] text-[var(--muted)]"
          title={statusText}
        >
          {statusText}
        </span>
      ) : null}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          title="Copy this week's shifts, open another week, then paste."
          onClick={() => copyWeek()}
        >
          Copy week
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !clip}
          title="Unlocked shifts in this week are replaced; locked shifts are kept."
          onClick={() => void pasteWeek()}
        >
          {busy ? "Pasting…" : "Paste week"}
        </button>
        {clip ? (
          <button type="button" className="btn btn-ghost" onClick={clearClipboard}>
            Clear
          </button>
        ) : null}
      </div>
    </>
  );
}
