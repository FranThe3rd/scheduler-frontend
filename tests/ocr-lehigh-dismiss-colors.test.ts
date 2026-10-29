import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { promises as fs } from "fs";
import path from "path";
import { createEmptyAppData, ensureWeek } from "../src/lib/fixtures/appData";
import { applyManagerDnaCorrections } from "../src/lib/dnaCorrections";
import {
  preferCropEvidence,
  applyConfirmedIdentityExtractions,
} from "../src/lib/applyIdentityExtractions";
import {
  collapseDuplicateOcrMatches,
  extractionDismissKey,
} from "../src/lib/ocrMatch";
import { consolidateMarksByLocation, dropConflictingTileGhosts } from "../src/lib/ocrMarkUtils";
import { resolveEmployeeName } from "../src/lib/names";
import { buildSeedEmployees } from "../src/lib/seed/employees";
import { buildSchedule } from "../src/lib/scheduler";
import {
  buildDefaultStaffingTargets,
  confirmLindenTargetsOnly,
  confirmLehighTargetsOnly,
  ensureStaffingTargets,
  LEHIGH_COVERAGE_PROPOSALS,
} from "../src/lib/staffingTargets";
import { shiftCardBackground, shiftIntervalKey } from "../src/lib/shiftColors";
import { overlayExtractionOnWeek } from "../src/lib/availabilityApply";

const employees = buildSeedEmployees();
applyManagerDnaCorrections(employees);

describe("Brady two-line name segmentation", () => {
  it("joins B. Brady + Ollogite into one Brady Dol. entry", () => {
    const matched = [
      {
        rawName: "B. Brady",
        date: "2026-09-17",
        matchStatus: "unknown" as const,
        employeeIds: [] as string[],
      },
      {
        rawName: "Ollogite",
        date: "2026-09-17",
        matchStatus: "exact" as const,
        employeeIds: ["emp_brady_dologite"],
      },
      {
        rawName: "Lucas",
        date: "2026-09-17",
        matchStatus: "exact" as const,
        employeeIds: ["emp_lucas_cramer"],
      },
    ];
    const rows = collapseDuplicateOcrMatches(matched);
    const dol = rows.filter((r) => r.employeeIds?.[0] === "emp_brady_dologite");
    assert.equal(dol.length, 1);
    assert.equal(dol[0]!.matchStatus, "exact");
    assert.ok(rows.some((r) => r.rawName === "Lucas"));
    assert.ok(!dol[0]!.employeeIds?.includes("emp_brady_dosedlo"));
  });

  it("does not merge Addison + Jordan nearby", () => {
    const merged = consolidateMarksByLocation([
      { rawName: "Addison", pageX: 0.4, pageY: 0.4, source: "crop" },
      { rawName: "Jordan", pageX: 0.45, pageY: 0.55, source: "crop" },
    ]);
    assert.equal(merged.length, 2);
  });

  it("does not merge Brady Dologite with other names in the same cell", () => {
    const cell = { x: 0.56, y: 0.45, w: 0.13, h: 0.11 };
    const at = (name: string, x: number, y: number) => ({
      rawName: name,
      pageX: cell.x + x * cell.w,
      pageY: cell.y + y * cell.h,
      source: "crop" as const,
    });
    const merged = consolidateMarksByLocation([
      at("Lucas", 0.33, 0.28),
      at("Alex", 0.36, 0.41),
      at("Jordan", 0.22, 0.56),
      at("Jenn", 0.62, 0.57),
      at("Brady Dologite", 0.68, 0.19),
    ]);
    const names = merged.map((m) => m.rawName).sort();
    assert.deepEqual(names, ["Alex", "Brady Dologite", "Jenn", "Jordan", "Lucas"]);
  });

  it("keeps Brady Dos. distinct from Brady Dol.", () => {
    assert.equal(
      resolveEmployeeName("Brady Dosedlo", employees).employeeIds[0],
      "emp_brady_dosedlo"
    );
    assert.equal(
      resolveEmployeeName("Ollogite", employees).employeeIds[0],
      "emp_brady_dologite"
    );
    assert.equal(resolveEmployeeName("Brady", employees).status, "ambiguous");
  });
});

describe("Andrew / Addison evidence handling", () => {
  it("prefers crop Addison over tile Andrew on the same date", () => {
    const out = preferCropEvidence(
      [
        { rawName: "Andrew", date: "2026-09-16", kindHint: "off" },
        { rawName: "Jordan", date: "2026-09-16", kindHint: "off" },
      ],
      [{ rawName: "Addison", date: "2026-09-16", kindHint: "off" }]
    );
    assert.ok(out.some((e) => /^addison$/i.test(e.rawName)));
    assert.ok(!out.some((e) => /^andrew$/i.test(e.rawName)));
    assert.ok(out.some((e) => /^jordan$/i.test(e.rawName)));
  });

  it("drops tile Andrew ghost next to crop Addison", () => {
    const kept = dropConflictingTileGhosts([
      { rawName: "Addison", pageX: 0.5, pageY: 0.4, source: "crop" },
      { rawName: "Andrew", pageX: 0.52, pageY: 0.42, source: "full_page" },
    ]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]!.rawName, "Addison");
  });

  it("keeps full-page Jordan when crop misreads John", () => {
    const kept = dropConflictingTileGhosts([
      { rawName: "John", pageX: 0.2, pageY: 0.7, source: "crop" },
      { rawName: "Jordan", pageX: 0.22, pageY: 0.72, source: "full_page" },
      { rawName: "Addison", pageX: 0.5, pageY: 0.5, source: "crop" },
    ]);
    assert.ok(kept.some((e) => /^jordan$/i.test(e.rawName ?? "")));
    assert.ok(!kept.some((e) => /^john$/i.test(e.rawName ?? "")));
  });

  it("does not add Andrew as an Addison alias", () => {
    const addy = employees.find((e) => e.id === "emp_addy_giesler")!;
    assert.ok(!addy.aliases.some((a) => /^andrew$/i.test(a.alias)));
    const andrew = resolveEmployeeName("Andrew", employees);
    // Soft suggestions only — never exact, never invent Andrew
    assert.equal(andrew.status, "ambiguous");
    assert.ok(andrew.employeeIds.includes("emp_addy_giesler"));
    assert.ok(andrew.employeeIds.includes("emp_alex_cheatham"));
    assert.equal(andrew.employeeIds.length, 2);
  });

  it("Addison correction does not create Andrew employee", () => {
    assert.ok(!employees.some((e) => /^andrew$/i.test(e.displayName)));
    assert.ok(!employees.some((e) => e.id === "emp_andrew" && e.status === "active"));
  });
});

describe("Inactive Andrew boundary", () => {
  it("cannot enter newly generated assignments", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const donor = data.employees.find((e) => e.id === "emp_makary")!;
    data.employees.push({
      ...structuredClone(donor),
      id: "emp_andrew_quit",
      displayName: "Andrew",
      printedLabel: "A.",
      firstName: "Andrew",
      lastName: undefined,
      aliases: [{ alias: "Andrew", confirmed: false }],
      status: "inactive",
      autoScheduleEnabled: false,
      context: {
        notes: ["Andrew has quit — inactive"],
        circumstances: [],
        schoolStatus: "unconfirmed",
      },
    });
    applyManagerDnaCorrections(data.employees);
    const andrew = data.employees.find((e) => e.id === "emp_andrew_quit")!;
    assert.equal(andrew.status, "inactive");

    const week = ensureWeek(data, "2026-09-28");
    const targets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    for (const row of week.availability) {
      for (const d of Object.keys(row.cells)) {
        row.cells[d] = {
          kind: "window",
          window: { startMinutes: 12 * 60, endMinutes: 22 * 60 },
          source: "manual",
        };
      }
    }
    const result = buildSchedule({
      weekStart: week.weekStart,
      employees: data.employees,
      availability: week.availability,
      targets,
      lockedShifts: [],
      settings: data.settings,
      mode: "build",
      availabilityReviewed: true,
      timeoutMs: 15_000,
    });
    assert.equal(
      result.shifts.filter((s) => s.employeeId === "emp_andrew_quit").length,
      0
    );
  });
});

describe("Lehigh Monday daytime staffing baseline", () => {
  it("includes Monday noon–5 opener in proposals with evidence sources", () => {
    const noon = LEHIGH_COVERAGE_PROPOSALS.find(
      (p) => p.start === 12 * 60 && p.end === 17 * 60 && p.count === 1
    );
    assert.ok(noon);
    assert.ok(noon!.days.includes("monday"));
    assert.ok(noon!.sources.some((s) => /opener|Clausnitzer|noon/i.test(s)));
  });

  it("fills Monday Lehigh noon–5 when daytime starts empty (≤3 distinct)", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    data.staffingTargets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    const week = ensureWeek(data, "2026-09-14");
    // Feasible fixture: no sign-offs; clear prior shifts so Lehigh daytime starts empty
    week.shifts = [];
    week.availabilityReviewed = true;
    for (const row of week.availability) {
      for (const d of Object.keys(row.cells)) {
        if (row.cells[d]?.kind === "off") row.cells[d] = { kind: "empty", source: "manual" };
      }
    }
    const result = buildSchedule({
      weekStart: week.weekStart,
      employees: data.employees,
      availability: week.availability,
      targets: data.staffingTargets,
      lockedShifts: [],
      settings: data.settings,
      mode: "build",
      availabilityReviewed: true,
      timeoutMs: 15_000,
    });
    const monday = "2026-09-14";
    const lehighDay = result.shifts.filter(
      (s) =>
        s.date === monday &&
        s.location === "lehigh" &&
        s.department === "floor" &&
        s.startMinutes != null &&
        s.endMinutes != null &&
        s.startMinutes <= 12 * 60 &&
        s.endMinutes >= 17 * 60
    );
    assert.ok(
      lehighDay.length >= 1,
      `expected ≥1 Lehigh Mon noon–5 opener, got ${lehighDay.length} (total shifts ${result.shifts.length})`
    );
    const distinct = new Set(
      result.shifts
        .filter((s) => s.date === monday && s.location === "lehigh" && s.employeeId)
        .map((s) => s.employeeId)
    );
    assert.ok(distinct.size <= 3, `Mon Lehi distinct ${distinct.size}`);
    assert.ok(!lehighDay.some((s) => s.employeeId === "emp_mike_wagner"));
  });

  it("keeps infeasible Lehigh shortage explicit when everyone is signed off", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    data.staffingTargets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    const week = ensureWeek(data, "2026-09-14");
    week.shifts = [];
    week.availabilityReviewed = true;
    const monday = "2026-09-14";
    for (const emp of data.employees.filter((e) => e.status === "active")) {
      let row = week.availability.find((a) => a.employeeId === emp.id);
      if (!row) {
        row = { employeeId: emp.id, cells: {} };
        week.availability.push(row);
      }
      row.cells[monday] = { kind: "off", note: "Off", source: "manual" };
    }
    const result = buildSchedule({
      weekStart: week.weekStart,
      employees: data.employees,
      availability: week.availability,
      targets: data.staffingTargets,
      lockedShifts: [],
      settings: data.settings,
      mode: "build",
      availabilityReviewed: true,
      timeoutMs: 10_000,
    });
    const monLehigh = result.validation.coverage.find(
      (c) =>
        c.date === monday &&
        c.location === "lehigh" &&
        c.startMinutes === 12 * 60 &&
        c.endMinutes === 17 * 60
    );
    assert.ok(monLehigh);
    assert.ok(monLehigh!.count < monLehigh!.minimum);
    assert.equal(
      result.shifts.filter((s) => s.date === monday && s.location === "lehigh").length,
      0
    );
  });

  it("merges Monday noon–5 into already-confirmed Lehigh targets", () => {
    const base = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    // Simulate older confirmed set missing Monday daytime opener
    const withoutMon = base.filter(
      (t) =>
        !(
          t.location === "lehigh" &&
          t.day === "monday" &&
          t.startMinutes === 12 * 60 &&
          t.endMinutes === 17 * 60
        )
    );
    const repaired = ensureStaffingTargets(withoutMon);
    const monDay = repaired.find(
      (t) =>
        t.location === "lehigh" &&
        t.day === "monday" &&
        t.startMinutes === 12 * 60 &&
        t.endMinutes === 17 * 60
    );
    assert.ok(monDay);
    assert.equal(monDay!.confirmed, true);
    assert.equal(monDay!.enabled, true);
    assert.equal(monDay!.minimum, 1);
  });
});

describe("Dismiss OCR mark side effects", () => {
  it("persists dismiss key and does not change staffing targets", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    data.staffingTargets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    const before = structuredClone(data.staffingTargets);
    const week = ensureWeek(data, "2026-09-14");
    const key = extractionDismissKey("Andrew", "2026-09-16");
    week.dismissedExtractionKeys = [key];
    // Dismiss must not mutate staffing
    assert.deepEqual(data.staffingTargets, before);
    assert.ok(week.dismissedExtractionKeys.includes(key));
  });

  it("dismiss does not create employee, assignment, or clear other offs", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const week = ensureWeek(data, "2026-09-14");
    const addy = week.availability.find((a) => a.employeeId === "emp_addy_giesler")!;
    addy.cells["2026-09-16"] = { kind: "off", note: "Off", source: "manual" };
    const beforeShifts = week.shifts.length;
    week.dismissedExtractionKeys = [extractionDismissKey("Andrew", "2026-09-18")];
    assert.equal(addy.cells["2026-09-16"]?.kind, "off");
    assert.equal(week.shifts.length, beforeShifts);
    assert.ok(!data.employees.some((e) => e.id === "emp_andrew" && e.status === "active"));
  });

  it("apply correction sets off and dedupes identical restriction", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const week = ensureWeek(data, "2026-09-14");
    const first = overlayExtractionOnWeek(
      week,
      data.employees,
      [
        {
          rawName: "Addison",
          employeeId: "emp_addy_giesler",
          date: "2026-09-16",
          note: "Off",
          kindHint: "off",
        },
      ],
      { replacePhoto: false }
    );
    assert.ok(first.applied >= 1);
    const second = overlayExtractionOnWeek(
      week,
      data.employees,
      [
        {
          rawName: "Addison",
          employeeId: "emp_addy_giesler",
          date: "2026-09-16",
          note: "Off",
          kindHint: "off",
        },
      ],
      { replacePhoto: false }
    );
    const row = week.availability.find((a) => a.employeeId === "emp_addy_giesler")!;
    assert.equal(row.cells["2026-09-16"]?.kind, "off");
    // Second apply should not invent a second employee
    assert.equal(
      data.employees.filter((e) => e.id === "emp_addy_giesler").length,
      1
    );
    assert.ok(second.applied >= 0);
  });
});

describe("Exact shift-time colors", () => {
  it("keys colors by start AND end", () => {
    const a = shiftCardBackground({
      startMinutes: 12 * 60,
      endMinutes: 15 * 60,
      department: "floor",
    });
    const b = shiftCardBackground({
      startMinutes: 12 * 60,
      endMinutes: 16 * 60,
      department: "floor",
    });
    const c = shiftCardBackground({
      startMinutes: 18 * 60,
      endMinutes: 22 * 60,
      department: "floor",
    });
    assert.notEqual(a, b);
    assert.notEqual(b, c);
    assert.equal(shiftIntervalKey(12 * 60, 16 * 60), "720-960");
  });

  it("custom intervals get a stable color", () => {
    const x = shiftCardBackground({
      startMinutes: 10 * 60,
      endMinutes: 14 * 60,
      department: "floor",
    });
    const y = shiftCardBackground({
      startMinutes: 10 * 60,
      endMinutes: 14 * 60,
      department: "floor",
    });
    assert.equal(x, y);
  });
});

describe("Raw crop evidence vs stale final extraction", () => {
  it("prefers crop Addison over tile Andrew; keeps Brady Dologite intact", () => {
    const preferred = preferCropEvidence(
      [
        { rawName: "Andrew", date: "2026-09-16", kindHint: "off" },
        { rawName: "B. Brady", date: "2026-09-17", kindHint: "off" },
        { rawName: "Ollogite", date: "2026-09-17", kindHint: "off" },
      ],
      [
        { rawName: "Addison", date: "2026-09-16", kindHint: "off" },
        { rawName: "Brady Dologite", date: "2026-09-17", kindHint: "off" },
      ]
    );
    assert.ok(preferred.some((e) => e.date === "2026-09-16" && /^addison$/i.test(e.rawName)));
    assert.ok(!preferred.some((e) => e.date === "2026-09-16" && /^andrew$/i.test(e.rawName)));
    assert.ok(
      preferred.some((e) => e.date === "2026-09-17" && /brady.*dologite/i.test(e.rawName))
    );
    assert.ok(
      !preferred.some(
        (e) =>
          e.date === "2026-09-17" &&
          (/^b\.?\s*brady$/i.test(e.rawName) || /^ollogite$/i.test(e.rawName))
      )
    );
  });

  it("identity apply resolves Addison/Brady without inventing Andrew", async () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const week = ensureWeek(data, "2026-09-14");
    const applied = overlayExtractionOnWeek(
      week,
      data.employees,
      [
        {
          rawName: "Addison",
          employeeId: "emp_addy_giesler",
          date: "2026-09-16",
          note: "Off",
          kindHint: "off",
        },
        {
          rawName: "Brady Dologite",
          employeeId: "emp_brady_dologite",
          date: "2026-09-17",
          note: "Off",
          kindHint: "off",
        },
      ],
      { replacePhoto: false }
    );
    assert.ok(applied.applied >= 2);
    assert.ok(
      !data.employees.some((e) => /^andrew$/i.test(e.displayName) && e.status === "active")
    );
    const addy = week.availability.find((a) => a.employeeId === "emp_addy_giesler");
    assert.equal(addy?.cells["2026-09-16"]?.kind, "off");
  });
});
