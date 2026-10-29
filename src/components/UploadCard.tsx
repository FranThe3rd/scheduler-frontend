"use client";

import { apiFetch } from "@/lib/api/client";

import { Camera, ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function UploadCard({
  weekStart,
  onExtracted,
  photoStorageKey,
}: {
  weekStart: string;
  photoStorageKey?: string | null;
  onExtracted: (payload: {
    ok?: boolean;
    message: string;
    configured: boolean;
    code?: string;
    storageKey?: string;
    entries: Array<{
      rawName: string;
      date?: string;
      weekday?: string;
      note?: string;
      kindHint?: string;
      crossedOut?: boolean;
      matchStatus?: string;
      employeeIds?: string[];
      matchMessage?: string;
    }>;
  }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"info" | "warn" | "ok">("info");
  const [ocrReady, setOcrReady] = useState<boolean | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);

  useEffect(() => {
    void apiFetch("/api/ocr")
      .then((r) => r.json())
      .then((j) => setOcrReady(Boolean(j.configured)))
      .catch(() => setOcrReady(false));
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    setStatus("Reading photo…");
    setStatusTone("info");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("weekStart", weekStart);
      const res = await apiFetch("/api/ocr", { method: "POST", body: form });
      const json = await res.json();

      if (!json.configured || json.code === "not_configured") {
        setStatusTone("warn");
        setStatus(json.message);
        onExtracted({ ...json, configured: false, entries: json.entries ?? [] });
        return;
      }

      if (!res.ok && !json.ok) {
        setStatusTone("warn");
        setStatus(json.message || json.error || "Photo reading failed");
        onExtracted({
          ...json,
          configured: true,
          message: json.message || json.error || "Photo reading failed",
          entries: [], // never leave stale extraction from a failed request
        });
        return;
      }

      setStatusTone(json.code === "empty" ? "warn" : "ok");
      setStatus(json.message);
      onExtracted(json);
    } catch (e) {
      setStatusTone("warn");
      setStatus(e instanceof Error ? e.message : "Upload failed");
      onExtracted({
        ok: false,
        configured: true,
        message: e instanceof Error ? e.message : "Upload failed",
        entries: [],
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="card mx-auto max-w-6xl px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary !min-h-10"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Camera size={18} />
          {busy ? "Reading…" : "Upload sign-off calendar"}
        </button>
        {photoStorageKey ? (
          <button
            type="button"
            className="btn btn-ghost !min-h-10 text-sm"
            onClick={() => setShowPhoto(true)}
          >
            <ImageIcon size={16} />
            View photo
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>

      {ocrReady === false && !status && (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Optional: upload a sign-off photo when OCR is wired up. For now, tap cells below to mark
          time off.
        </p>
      )}
      {status ? (
        <p
          className={`mt-2 text-sm ${
            statusTone === "warn" ? "text-[#8a4b2a]" : "text-[var(--muted)]"
          }`}
        >
          {status}
        </p>
      ) : null}

      {showPhoto && photoStorageKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-3xl overflow-auto p-3">
            <div className="mb-2 flex justify-between gap-2">
              <span className="text-sm font-semibold">Uploaded calendar</span>
              <button type="button" className="btn btn-ghost !min-h-8 text-sm" onClick={() => setShowPhoto(false)}>
                Close
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/ocr/photo?key=${encodeURIComponent(photoStorageKey)}`}
              alt="Uploaded sign-off calendar"
              className="mx-auto max-h-[75vh] w-auto max-w-full rounded-lg"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
