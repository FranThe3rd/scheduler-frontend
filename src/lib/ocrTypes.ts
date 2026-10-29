/** Shared OCR / calendar-photo types (UI + domain). Vision pipeline is backend-owned. */

export type OcrEntry = {
  rawName: string;
  date?: string;
  weekday?: string;
  note?: string;
  kindHint?: "off" | "after" | "until" | "window" | "open" | "unclear" | "empty";
  crossedOut?: boolean;
  uncertain?: boolean;
  needsReview?: boolean;
  matchStatus?: "exact" | "ambiguous" | "unknown";
  employeeIds?: string[];
  matchMessage?: string;
  reviewHeadline?: string;
  extractionFailed?: boolean;
  cropDay?: number;
};

export type DayCellStatus =
  | "verified_empty"
  | "has_marks"
  | "has_unreadable"
  | "date_uncertain"
  | "extraction_failed"
  | "not_attempted";

export type DayCellReport = {
  date: string;
  printedDay: number;
  status: DayCellStatus;
  markCount: number;
  note?: string;
  cropDebugName?: string;
};

export type OcrExtraction = {
  ok: boolean;
  configured: boolean;
  code:
    | "ok"
    | "not_configured"
    | "provider_error"
    | "parse_error"
    | "empty"
    | "week_mismatch";
  message: string;
  weekStart?: string;
  weekEnd?: string;
  entries: OcrEntry[];
  uncertainReadings?: string[];
  dayReports?: DayCellReport[];
  debug?: {
    model: string;
    passes: string[];
    apiCalls: number;
    structureCells: number;
    fullPageEntries: number;
    cropPasses: number;
    rawEntryCount: number;
    geometryOverlay?: string;
    photoMonth?: string;
    photoYear?: number;
    calendarStartsOn?: string;
  };
};
