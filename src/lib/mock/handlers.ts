import { format } from "date-fns";
import { overlayExtractionOnWeek } from "../availabilityApply";
import { toCsv } from "../export";
import { buildSchedule, findReplacementCandidates } from "../scheduler";
import {
  buildBlankWeek,
  listPreviousSchedules,
  rememberWorkingWeekInPrevious,
  restoreSavedSession,
  setWorkingWeekPhotoKey,
  startFreshCreationSession,
} from "../scheduleSession";
import {
  confirmLehighTargetsOnly,
  confirmLindenTargetsOnly,
  ensureStaffingTargets,
} from "../staffingTargets";
import { createEmployee } from "../createEmployee";
import type { AppData, AvailabilityCell, Employee, Shift } from "../types";
import { mondayOf, newId, thisWeekMondayNy, weekDates } from "../time";
import { isAvailabilityCalendarEntered } from "../validation";
import {
  DEMO_WEEK_START,
  getMockAppData,
  lehighProposalSources,
  staffingConfirmationStatus,
  syncWeek,
  weekFor,
} from "./store";
import { buildOct2025DemoWeek } from "./oct2025Schedule";
import { type ShiftTemplate, type WeekClipboard } from "../scheduleClipboard";

export type MockResult =
  | { status: number; json: unknown }
  | { status: number; text: string; contentType: string };

function bootstrapPayload(data: AppData, weekStart: string) {
  const staffingStatus = staffingConfirmationStatus(data.staffingTargets);
  const existing = data.weeks.find((w) => w.weekStart === weekStart);
  const weekPreview =
    existing ??
    buildBlankWeek(data, weekStart);
  return {
    mode: "local_mock",
    sessionMode: "shell",
    storageNote: "Frontend mock — in-memory schedule data.",
    settings: data.settings,
    employees: data.employees,
    staffingTargets: data.staffingTargets,
    roleTargets: data.roleTargets,
    sharedRowPatterns: data.sharedRowPatterns,
    history: data.history,
    week: structuredClone(weekPreview),
    previousSchedules: listPreviousSchedules(data),
    confirmedTargetCount: data.staffingTargets.filter((t) => t.confirmed && t.enabled).length,
    staffingStatus,
    suggestClearDraft: false,
    availabilityEntered: isAvailabilityCalendarEntered(weekPreview.availability),
    pendingUnclearMarks: [],
  };
}

function handleSchedulePost(data: AppData, body: Record<string, unknown>): MockResult {
  const weekStart = String(body.weekStart ?? "");
  const week = weekFor(data, weekStart);
  const mode = String(body.mode ?? "build");

  if (mode === "clear_draft" || mode === "start_over") {
    week.shifts = mode === "start_over" ? [] : week.shifts.filter((s) => s.locked);
    if (mode === "start_over") week.status = "draft";
    week.acknowledgmentAccepted = false;
    week.acknowledgmentRequired = false;
    syncWeek(data, week);
    return { status: 200, json: { week } };
  }

  const locked =
    mode === "rebuild_unlocked" ? week.shifts.filter((s) => s.locked) : week.shifts.filter((s) => s.locked);
  const buildMode = mode === "preview_patterns" ? "preview_patterns" : "build";
  const result = buildSchedule({
    weekStart,
    employees: data.employees,
    availability: week.availability,
    availabilityReviewed: week.availabilityReviewed || mode === "preview_patterns",
    targets: data.staffingTargets,
    lockedShifts: locked,
    settings: data.settings,
    mode: buildMode,
  });

  week.shifts = result.shifts;
  week.buildMeta = {
    durationMs: result.durationMs,
    partial: result.partial,
    timedOut: result.timedOut,
    mode: buildMode,
  };
  if (mode === "build" || mode === "rebuild_unlocked") {
    rememberWorkingWeekInPrevious(data, weekStart);
  }

  syncWeek(data, week);
  return { status: 200, json: { week, blockedReason: result.blockedReason } };
}

function shiftFromTemplate(template: ShiftTemplate, date: string): Shift {
  return {
    id: newId("shift"),
    employeeId: template.employeeId,
    unresolvedLabel: template.unresolvedLabel,
    date,
    startMinutes: template.startMinutes,
    endMinutes: template.endMinutes,
    location: template.location,
    department: template.department,
    notes: template.notes,
    locked: false,
    source: "manual",
  };
}

function handleSchedulePut(data: AppData, body: Record<string, unknown>): MockResult {
  const weekStart = String(body.weekStart ?? "");
  const week = weekFor(data, weekStart);
  const action = String(body.action ?? "");

  if (action === "paste_week") {
    const items = (body.items as WeekClipboard["items"]) ?? [];
    const dates = weekDates(weekStart);
    const dateSet = new Set(dates);
    week.shifts = week.shifts.filter((s) => !dateSet.has(s.date) || s.locked);
    for (const item of items) {
      const date = dates[item.dayIndex];
      if (!date) continue;
      week.shifts.push(
        shiftFromTemplate(
          {
            employeeId: item.employeeId,
            unresolvedLabel: item.unresolvedLabel,
            startMinutes: item.startMinutes,
            endMinutes: item.endMinutes,
            location: item.location,
            department: item.department,
            notes: item.notes,
          },
          date
        )
      );
    }
    syncWeek(data, week);
    return { status: 200, json: { week, pasted: items.length } };
  }

  if (action === "delete") {
    const shiftId = String(body.shiftId ?? "");
    week.shifts = week.shifts.filter((s) => s.id !== shiftId);
    syncWeek(data, week);
    return { status: 200, json: { week } };
  }

  if (action === "upsert") {
    const shift = body.shift as Partial<Shift> & { date: string };
    const existing = shift.id ? week.shifts.find((s) => s.id === shift.id) : undefined;
    const next: Shift = {
      id: existing?.id ?? newId("shift"),
      employeeId: shift.employeeId ?? existing?.employeeId ?? null,
      unresolvedLabel: shift.unresolvedLabel ?? existing?.unresolvedLabel,
      date: shift.date,
      startMinutes: shift.startMinutes ?? existing?.startMinutes ?? null,
      endMinutes: shift.endMinutes ?? existing?.endMinutes ?? null,
      location: shift.location ?? existing?.location ?? "unknown",
      department: shift.department ?? existing?.department ?? "floor",
      locked: shift.locked ?? existing?.locked ?? false,
      notes: shift.notes ?? existing?.notes,
      source: "manual",
    };
    week.shifts = existing
      ? week.shifts.map((s) => (s.id === existing.id ? next : s))
      : [...week.shifts, next];
    syncWeek(data, week);
    return { status: 200, json: { week } };
  }

  if (action === "assign_employee_week") {
    const employeeId = String(body.employeeId ?? "");
    const assigned = Array.isArray(body.shifts) ? (body.shifts as Array<Partial<Shift> & { date: string }>) : [];
    if (!employeeId || !data.employees.some((employee) => employee.id === employeeId)) {
      return { status: 404, json: { error: "Employee not found" } };
    }
    week.shifts = week.shifts.filter((shift) => shift.employeeId !== employeeId);
    for (const shift of assigned) {
      week.shifts.push({
        id: newId("shift"),
        employeeId,
        date: shift.date,
        startMinutes: shift.startMinutes ?? null,
        endMinutes: shift.endMinutes ?? null,
        location: shift.location ?? "unknown",
        department: shift.department ?? "floor",
        locked: true,
        source: "manual",
      });
    }
    syncWeek(data, week);
    return { status: 200, json: { week } };
  }

  if (action === "approve") {
    const acknowledge = Boolean(body.acknowledgeIncomplete);
    const hard = week.issues.filter((i) => i.severity === "hard");
    if (hard.length > 0 && !acknowledge) {
      week.acknowledgmentRequired = true;
      return {
        status: 409,
        json: {
          error: "Schedule has unresolved hard issues. Acknowledge to approve anyway.",
          week,
        },
      };
    }
    week.status = "approved";
    week.approvedAt = new Date().toISOString();
    week.approvedSnapshot = structuredClone(week.shifts);
    week.acknowledgmentAccepted = acknowledge;
    week.acknowledgmentRequired = false;
    return { status: 200, json: { week } };
  }

  return { status: 400, json: { error: "Unknown schedule action" } };
}

function addEmployeeAvailabilityRows(data: AppData, employee: Employee): void {
  if (employee.status !== "active") return;
  for (const week of data.weeks) {
    if (week.availability.some((a) => a.employeeId === employee.id)) continue;
    const dates = weekDates(week.weekStart);
    week.availability.push({
      employeeId: employee.id,
      cells: Object.fromEntries(dates.map((d) => [d, { kind: "empty" as const }])),
    });
  }
}

function removeEmployeeEverywhere(data: AppData, employeeId: string): void {
  data.employees = data.employees.filter((e) => e.id !== employeeId);
  const weeks = [
    ...data.weeks,
    ...(data.savedSessions ?? []).map((session) => session.week),
  ];
  for (const week of weeks) {
    week.shifts = week.shifts.filter((s) => s.employeeId !== employeeId);
    week.availability = week.availability.filter((a) => a.employeeId !== employeeId);
    if (week.approvedSnapshot) {
      week.approvedSnapshot = week.approvedSnapshot.filter((s) => s.employeeId !== employeeId);
    }
    syncWeek(data, week);
  }
  for (const session of data.savedSessions ?? []) {
    session.shiftCount = session.week.shifts.length;
  }
  for (const historicalWeek of data.history) {
    historicalWeek.shifts = historicalWeek.shifts.filter((shift) => shift.employeeId !== employeeId);
  }
  data.sharedRowPatterns = data.sharedRowPatterns
    .map((pattern) => ({
      ...pattern,
      relatedEmployeeIds: pattern.relatedEmployeeIds.filter((id) => id !== employeeId),
    }))
    .filter((pattern) => pattern.relatedEmployeeIds.length > 0);
}

function handleAvailability(data: AppData, method: string, body: Record<string, unknown>): MockResult {
  const weekStart = String(body.weekStart ?? "");
  const week = weekFor(data, weekStart);

  if (method === "PUT") {
    const employeeId = String(body.employeeId ?? "");
    const date = String(body.date ?? "");
    const cell = body.cell as AvailabilityCell;
    const row = week.availability.find((a) => a.employeeId === employeeId);
    if (row && date) {
      row.cells[date] = { ...cell, source: cell.source ?? "manual" };
    }
    syncWeek(data, week);
    return { status: 200, json: { week } };
  }

  const action = String(body.action ?? "");
  if (action === "mark_reviewed") {
    week.availabilityReviewed = true;
    syncWeek(data, week);
    return { status: 200, json: { week } };
  }

  if (action === "apply_extraction") {
    const entries = (body.entries as Array<Record<string, unknown>>) ?? [];
    overlayExtractionOnWeek(
      week,
      data.employees,
      entries.map((e) => ({
        rawName: String(e.rawName ?? ""),
        employeeId: e.employeeId as string | undefined,
        date: e.date as string | undefined,
        note: e.note as string | undefined,
        kindHint: e.kindHint as string | undefined,
        crossedOut: Boolean(e.crossedOut),
      })),
      { replacePhoto: Boolean(body.replacePhoto) }
    );
    syncWeek(data, week);
    return { status: 200, json: { week } };
  }

  if (action === "dismiss_extraction" || action === "undismiss_extraction") {
    const key = String(body.dismissKey ?? "");
    const keys = new Set(week.dismissedExtractionKeys ?? []);
    if (action === "dismiss_extraction") keys.add(key);
    else keys.delete(key);
    week.dismissedExtractionKeys = [...keys];
    syncWeek(data, week);
    return { status: 200, json: { week } };
  }

  return { status: 400, json: { error: "Unknown availability action" } };
}

export function handleMockRequest(
  pathname: string,
  method: string,
  rawBody: BodyInit | null | undefined,
  searchParams: URLSearchParams
): MockResult {
  const data = getMockAppData();
  let body: Record<string, unknown> = {};
  if (rawBody && typeof rawBody === "string") {
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  if (pathname === "/api/bootstrap" && method === "GET") {
    const weekParam = searchParams.get("week") ?? thisWeekMondayNy();
    const weekStart = format(mondayOf(weekParam), "yyyy-MM-dd");
    // Re-seed demo week only when explicitly requested (full reload still re-inits mock store).
    if (searchParams.get("resetDemo") === "1" && weekStart === DEMO_WEEK_START) {
      buildOct2025DemoWeek(data);
    }
    return { status: 200, json: bootstrapPayload(data, weekStart) };
  }

  if (pathname === "/api/session" && method === "POST") {
    const action = String(body.action ?? "");
    const staffingStatus = staffingConfirmationStatus(data.staffingTargets);
    if (action === "set_photo") {
      const weekStart = format(mondayOf(String(body.weekStart ?? new Date())), "yyyy-MM-dd");
      setWorkingWeekPhotoKey(data, weekStart, (body.photoStorageKey as string | null) ?? null);
      const week = data.weeks.find((w) => w.weekStart === weekStart);
      return { status: 200, json: { week, previousSchedules: listPreviousSchedules(data) } };
    }
    if (action === "start") {
      const weekStart = format(mondayOf(String(body.weekStart ?? new Date())), "yyyy-MM-dd");
      const { week, archived } = startFreshCreationSession(data, weekStart);
      syncWeek(data, week);
      return {
        status: 200,
        json: {
          sessionMode: "fresh",
          archived,
          week,
          employees: data.employees,
          settings: data.settings,
          staffingStatus,
          previousSchedules: listPreviousSchedules(data),
          pendingUnclearMarks: [],
          suggestClearDraft: false,
        },
      };
    }
    if (action === "restore") {
      const sessionId = String(body.sessionId ?? "");
      const restored = restoreSavedSession(data, sessionId);
      if (!restored) return { status: 404, json: { error: "Saved schedule not found" } };
      syncWeek(data, restored.week);
      return {
        status: 200,
        json: {
          sessionMode: "restored",
          week: restored.week,
          photoStorageKey: restored.photoStorageKey,
          previousSchedules: listPreviousSchedules(data),
        },
      };
    }
    return { status: 400, json: { error: "Unknown session action" } };
  }

  if (pathname === "/api/availability" && (method === "PUT" || method === "POST")) {
    return handleAvailability(data, method, body);
  }

  if (pathname === "/api/schedule") {
    if (method === "POST") return handleSchedulePost(data, body);
    if (method === "PUT") return handleSchedulePut(data, body);
    if (method === "PATCH") {
      const week = weekFor(data, String(body.weekStart ?? ""));
      const candidates = findReplacementCandidates({
        date: String(body.date ?? ""),
        startMinutes: Number(body.startMinutes ?? 18 * 60),
        endMinutes: Number(body.endMinutes ?? 22 * 60),
        location: (body.location as Shift["location"]) ?? "unknown",
        department: (body.department as Shift["department"]) ?? "floor",
        employees: data.employees,
        availability: week.availability,
        shifts: week.shifts,
      });
      return { status: 200, json: { candidates } };
    }
  }

  if (pathname === "/api/settings") {
    if (method === "GET") {
      return {
        status: 200,
        json: {
          settings: data.settings,
          staffingTargets: data.staffingTargets,
          staffingStatus: staffingConfirmationStatus(data.staffingTargets),
          lehighProposalSources: lehighProposalSources(),
          history: data.history,
          mode: "local_mock",
        },
      };
    }
    if (method === "PUT") {
      if (body.settings) Object.assign(data.settings, body.settings);
      if (body.staffingTargets) data.staffingTargets = ensureStaffingTargets(body.staffingTargets as AppData["staffingTargets"]);
      if (body.confirmLindenTargets) {
        data.staffingTargets = confirmLindenTargetsOnly(data.staffingTargets);
      }
      if (body.confirmLehighTargets) {
        data.staffingTargets = confirmLehighTargetsOnly(data.staffingTargets);
      }
      data.settings.staffingTargetsNeedConfirmation = !staffingConfirmationStatus(
        data.staffingTargets
      ).bothConfirmed;
      return {
        status: 200,
        json: {
          settings: data.settings,
          staffingTargets: data.staffingTargets,
          staffingStatus: staffingConfirmationStatus(data.staffingTargets),
          lehighProposalSources: lehighProposalSources(),
        },
      };
    }
    if (method === "POST") {
      const action = String(body.action ?? "");
      if (action === "add_history_week" && body.week) {
        const w = body.week as AppData["history"][0];
        data.history.push({ ...w, id: w.id ?? newId("hist"), shifts: w.shifts ?? [] });
        return { status: 200, json: { history: data.history } };
      }
      if (action === "set_authoritative") {
        const weekId = String(body.weekId ?? "");
        for (const h of data.history) {
          h.authoritative = h.id === weekId;
        }
        return { status: 200, json: { history: data.history } };
      }
    }
  }

  if (pathname === "/api/employees") {
    if (method === "GET") return { status: 200, json: { employees: data.employees } };
    if (method === "PUT" && body.employee) {
      const emp = body.employee as AppData["employees"][0];
      const prev = data.employees.find((e) => e.id === emp.id);
      data.employees = data.employees.map((e) => (e.id === emp.id ? emp : e));
      if (prev?.status !== "active" && emp.status === "active") {
        addEmployeeAvailabilityRows(data, emp);
      }
      if (prev?.status === "active" && emp.status !== "active") {
        for (const week of data.weeks) {
          week.availability = week.availability.filter((a) => a.employeeId !== emp.id);
          syncWeek(data, week);
        }
      }
      return { status: 200, json: { employee: emp } };
    }
    if (method === "POST") {
      const displayName = String(body.displayName ?? "").trim();
      if (!displayName) {
        return { status: 400, json: { error: "Display name is required" } };
      }
      const printedLabel = String(body.printedLabel ?? displayName).trim() || displayName;
      const employee = createEmployee({
        displayName,
        printedLabel,
        colorIndex: data.employees.length,
      });
      data.employees = [...data.employees, employee];
      addEmployeeAvailabilityRows(data, employee);
      return { status: 201, json: { employee } };
    }
    if (method === "DELETE") {
      const employeeId = String(body.employeeId ?? searchParams.get("id") ?? "");
      if (!employeeId || !data.employees.some((e) => e.id === employeeId)) {
        return { status: 404, json: { error: "Employee not found" } };
      }
      removeEmployeeEverywhere(data, employeeId);
      return { status: 200, json: { ok: true } };
    }
  }

  if (pathname === "/api/auth") {
    if (method === "GET") {
      return { status: 200, json: { required: false, configured: false } };
    }
    if (method === "POST") {
      return { status: 200, json: { ok: true } };
    }
  }

  if (pathname === "/api/ocr") {
    if (method === "GET") {
      return {
        status: 200,
        json: {
          configured: false,
          provider: "Mock frontend — OCR not wired",
          model: "n/a",
        },
      };
    }
    if (method === "POST") {
      return {
        status: 200,
        json: {
          ok: false,
          configured: false,
          code: "not_configured",
          message:
            "Photo reading is disabled in mock mode. Use the pre-loaded Oct 6–12 schedule or edit shifts manually.",
          entries: [],
        },
      };
    }
  }

  if (pathname === "/api/print" && method === "GET") {
    const weekStart = format(mondayOf(searchParams.get("weekStart") ?? DEMO_WEEK_START), "yyyy-MM-dd");
    const week = data.weeks.find((w) => w.weekStart === weekStart) ?? weekFor(data, weekStart);
    return {
      status: 200,
      json: {
        week,
        employees: data.employees,
        staffingTargets: data.staffingTargets,
      },
    };
  }

  if (pathname === "/api/export" && method === "GET") {
    const weekStart = format(mondayOf(searchParams.get("week") ?? DEMO_WEEK_START), "yyyy-MM-dd");
    const week = weekFor(data, weekStart);
    const formatType = searchParams.get("format") ?? "csv";
    if (formatType !== "csv") {
      return { status: 400, json: { error: "Only CSV export in mock mode" } };
    }
    const shifts = week.shifts.length > 0 ? week.shifts : week.approvedSnapshot ?? [];
    const exportWeek = { ...week, shifts };
    const csv = toCsv(exportWeek, data.employees);
    return { status: 200, text: csv, contentType: "text/csv" };
  }

  return { status: 404, json: { error: `Mock API: ${method} ${pathname} not found` } };
}
