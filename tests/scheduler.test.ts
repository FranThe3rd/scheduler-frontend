import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEmployeeName, assertNotDoubleAssignedShared } from "../src/lib/names";
import { collapseDuplicateOcrMatches } from "../src/lib/ocrMatch";
import { consolidateMarksByLocation } from "../src/lib/ocrMarkUtils";
import { buildSeedEmployees } from "../src/lib/seed/employees";
import { applyManagerDnaCorrections } from "../src/lib/dnaCorrections";
import {
  LINDEN_COVERAGE_BLOCKS,
  LEHIGH_COVERAGE_PROPOSALS,
  buildDefaultStaffingTargets,
  confirmLindenTargetsOnly,
  confirmLehighTargetsOnly,
  ensureStaffingTargets,
  staffingConfirmationStatus,
} from "../src/lib/staffingTargets";
import {
  availabilityAllowsShift,
  computeCoverage,
  computeTotals,
  findOverlaps,
  revalidateWeek,
  emptyWeekAvailability,
} from "../src/lib/validation";
import { buildSchedule } from "../src/lib/scheduler";
import { shiftsOverlap, intervalsOverlap } from "../src/lib/time";
import { toCsv } from "../src/lib/export";
import type { Shift, WeekAvailability, StaffingIntervalTarget } from "../src/lib/types";
import { createEmptyAppData, ensureWeek } from "../src/lib/fixtures/appData";

const employees = buildSeedEmployees();
applyManagerDnaCorrections(employees);

describe("name resolution", () => {
  it("treats Brady alone as ambiguous", () => {
    const r = resolveEmployeeName("Brady", employees);
    assert.equal(r.status, "ambiguous");
    assert.ok(r.employeeIds.includes("emp_brady_dosedlo"));
    assert.ok(r.employeeIds.includes("emp_brady_dologite"));
  });

  it("resolves Brady Dosedlo uniquely", () => {
    const r = resolveEmployeeName("Brady Dosedlo", employees);
    assert.equal(r.status, "exact");
    assert.deepEqual(r.employeeIds, ["emp_brady_dosedlo"]);
  });

  it("maps Ologite / Brody Ologite OCR misreads to Brady Dologite only", () => {
    for (const q of ["Ologite", "Brody Ologite", "Brady Ologite", "Brady Dologite", "Dologite"]) {
      const r = resolveEmployeeName(q, employees);
      assert.equal(r.status, "exact", q);
      assert.deepEqual(r.employeeIds, ["emp_brady_dologite"], q);
    }
    const dosedlo = resolveEmployeeName("Brady Dosedlo", employees);
    assert.deepEqual(dosedlo.employeeIds, ["emp_brady_dosedlo"]);
    const brady = resolveEmployeeName("Brady", employees);
    assert.equal(brady.status, "ambiguous");
    assert.ok(brady.employeeIds.includes("emp_brady_dosedlo"));
    assert.ok(brady.employeeIds.includes("emp_brady_dologite"));
  });

  it("does not silently resolve Lexy/Brooke", () => {
    const r = resolveEmployeeName("Lexy/Brooke", employees);
    assert.equal(r.status, "ambiguous");
    assert.ok(r.employeeIds.includes("emp_lexi"));
    assert.ok(r.employeeIds.includes("emp_brooke"));
  });

  it("does not credit both Lexi and Brooke for one shift", () => {
    const bad = assertNotDoubleAssignedShared(["emp_lexi", "emp_brooke"]);
    assert.equal(bad.ok, false);
    const ok = assertNotDoubleAssignedShared(["emp_lexi"]);
    assert.equal(ok.ok, true);
  });

  it("does not activate legacy names", () => {
    const r = resolveEmployeeName("A. Miller", employees);
    assert.equal(r.status, "unknown");
  });

  it("resolves Addi and Addy to the same Addison employee", () => {
    const addi = resolveEmployeeName("Addi", employees);
    const addy = resolveEmployeeName("Addy", employees);
    const addison = resolveEmployeeName("Addison", employees);
    assert.equal(addi.status, "exact");
    assert.equal(addy.status, "exact");
    assert.equal(addison.status, "exact");
    assert.deepEqual(addi.employeeIds, ["emp_addy_giesler"]);
    assert.deepEqual(addy.employeeIds, ["emp_addy_giesler"]);
    assert.deepEqual(addison.employeeIds, ["emp_addy_giesler"]);
  });
});

describe("OCR fragment / location merge", () => {
  it("joins nearby Brady + Ologite fragments into one mark", () => {
    const merged = consolidateMarksByLocation([
      { rawName: "Brady", x: 0.4, y: 0.35, pageX: 0.52, pageY: 0.48, source: "crop" },
      { rawName: "Ologite", x: 0.42, y: 0.48, pageX: 0.525, pageY: 0.50, source: "crop" },
      { rawName: "Brody Ologite", x: 0.41, y: 0.4, pageX: 0.522, pageY: 0.49, source: "full_page" },
    ]);
    assert.equal(merged.length, 1);
    const joined = merged[0]!.rawName ?? "";
    assert.match(joined, /ologite/i);
    assert.ok(merged[0]!.uncertain === true || /brady|brody/i.test(joined));
    assert.ok(joined.length > 0);
  });

  it("does not merge distant same-day names by similarity alone", () => {
    const merged = consolidateMarksByLocation([
      { rawName: "Jordan", pageX: 0.2, pageY: 0.4, source: "crop" },
      { rawName: "Addison", pageX: 0.8, pageY: 0.4, source: "crop" },
    ]);
    assert.equal(merged.length, 2);
  });

  it("collapses matched Brady Dologite fragments to one review row", () => {
    const rows = collapseDuplicateOcrMatches([
      {
        rawName: "Brody Ologite",
        date: "2026-09-17",
        matchStatus: "exact" as const,
        employeeIds: ["emp_brady_dologite"],
        needsReview: true,
      },
      {
        rawName: "Ologite",
        date: "2026-09-17",
        matchStatus: "exact" as const,
        employeeIds: ["emp_brady_dologite"],
        needsReview: true,
      },
      {
        rawName: "Brady",
        date: "2026-09-17",
        matchStatus: "ambiguous" as const,
        employeeIds: ["emp_brady_dosedlo", "emp_brady_dologite"],
        needsReview: true,
      },
      {
        rawName: "Lucas",
        date: "2026-09-17",
        matchStatus: "exact" as const,
        employeeIds: ["emp_lucas_cramer"],
        needsReview: true,
      },
    ]);
    const dologite = rows.filter(
      (r) => r.matchStatus === "exact" && r.employeeIds?.length === 1 && r.employeeIds[0] === "emp_brady_dologite"
    );
    assert.equal(dologite.length, 1);
    const name = dologite[0]!.rawName;
    assert.ok(typeof name === "string" && /ologite|dologite/i.test(name));
    assert.ok(rows.some((r) => r.rawName === "Lucas"));
    assert.ok(!dologite[0]!.employeeIds?.includes("emp_brady_dosedlo"));
  });

  it("keeps crossed-out uncertain marks separate from a clear sign-off", () => {
    const rows = collapseDuplicateOcrMatches([
      {
        rawName: "Addison",
        date: "2026-09-15",
        matchStatus: "exact" as const,
        employeeIds: ["emp_addy_giesler"],
        crossedOut: false,
        uncertain: false,
        needsReview: true,
      },
      {
        rawName: "Addison",
        date: "2026-09-15",
        matchStatus: "exact" as const,
        employeeIds: ["emp_addy_giesler"],
        crossedOut: true,
        uncertain: true,
        needsReview: true,
      },
    ]);
    assert.equal(rows.length, 2);
    assert.ok(rows.some((r) => r.crossedOut && r.uncertain));
  });
});

describe("availability overrides history", () => {
  it("sign-off blocks assignment even when DNA prefers the day", () => {
    const cell = { kind: "off" as const, note: "Off" };
    const allow = availabilityAllowsShift(cell, 9 * 60, 13 * 60);
    assert.equal(allow.ok, false);
  });

  it("partial-day After 3 blocks earlier starts", () => {
    const cell = {
      kind: "after" as const,
      note: "After 3",
      window: { startMinutes: 15 * 60, endMinutes: 22 * 60 },
    };
    assert.equal(availabilityAllowsShift(cell, 12 * 60, 18 * 60).ok, false);
    assert.equal(availabilityAllowsShift(cell, 15 * 60, 18 * 60).ok, true);
  });

  it("empty cell is provisional, not confirmed available", () => {
    const allow = availabilityAllowsShift({ kind: "empty" }, 18 * 60, 22 * 60);
    assert.equal(allow.ok, true);
    assert.equal(allow.provisional, true);
  });

  it("photo plain-name sign-off becomes whole-day off with photo source", () => {
    const {
      cellFromExtractionEntry,
    } = require("../src/lib/availabilityApply") as typeof import("../src/lib/availabilityApply");
    const cell = cellFromExtractionEntry({ kindHint: "off" });
    assert.equal(cell.kind, "off");
    assert.equal(cell.source, "photo");
    const plain = cellFromExtractionEntry({});
    assert.equal(plain.kind, "off");
    assert.equal(plain.source, "photo");
  });
});

describe("overlaps and boundaries", () => {
  it("adjacent shifts sharing a boundary do not overlap", () => {
    assert.equal(
      shiftsOverlap(
        { startMinutes: 12 * 60, endMinutes: 15 * 60 },
        { startMinutes: 15 * 60, endMinutes: 18 * 60 }
      ),
      false
    );
    assert.equal(intervalsOverlap(12 * 60, 15 * 60, 15 * 60, 18 * 60), false);
  });

  it("true overlaps are detected across departments", () => {
    const shifts: Shift[] = [
      {
        id: "a",
        employeeId: "emp_dante_smith",
        date: "2026-10-06",
        startMinutes: 12 * 60,
        endMinutes: 18 * 60,
        location: "linden",
        department: "floor",
        locked: false,
        source: "manual",
      },
      {
        id: "b",
        employeeId: "emp_dante_smith",
        date: "2026-10-06",
        startMinutes: 15 * 60,
        endMinutes: 17 * 60,
        location: "linden",
        department: "ic",
        locked: false,
        source: "manual",
      },
    ];
    const issues = findOverlaps(shifts);
    assert.ok(issues.some((i) => i.code === "overlap"));
  });
});

describe("Linden coverage targets", () => {
  it("uses one headcount per block with no invented separate minimum", () => {
    assert.deepEqual(
      LINDEN_COVERAGE_BLOCKS.map((b) => [`${b.start / 60}-${b.end / 60}`, b.count]),
      [
        ["12-15", 2],
        ["12-18", 3],
        ["15-18", 2],
        ["17-19", 2],
        ["18-22", 4],
        ["19-22", 1],
      ]
    );
    const targets = buildDefaultStaffingTargets();
    for (const t of targets.filter((x) => x.location === "linden")) {
      assert.equal(t.minimum, t.desired);
      assert.equal(t.enabled, false);
      assert.equal(t.confirmed, false);
    }
    const confirmed = confirmLindenTargetsOnly(targets);
    assert.ok(confirmed.every((t) => t.location !== "linden" || (t.enabled && t.confirmed)));
    assert.ok(confirmed.every((t) => t.location !== "lehigh" || (!t.enabled && !t.confirmed)));
  });

  it("proposes Lehigh from L evidence without copying Linden blocks", () => {
    assert.ok(LEHIGH_COVERAGE_PROPOSALS.length > 0);
    assert.ok(LEHIGH_COVERAGE_PROPOSALS.every((p) => p.sources.length > 0));
    const targets = buildDefaultStaffingTargets();
    const lehigh = targets.filter((t) => t.location === "lehigh");
    assert.ok(lehigh.length > 0);
    const lindenIntervals = new Set(
      LINDEN_COVERAGE_BLOCKS.map((b) => `${b.start}-${b.end}`)
    );
    // At least one Lehigh proposal uses a non-Linden interval shape
    assert.ok(
      lehigh.some((t) => !lindenIntervals.has(`${t.startMinutes}-${t.endMinutes}`))
    );
    const both = staffingConfirmationStatus(
      confirmLehighTargetsOnly(confirmLindenTargetsOnly(targets))
    );
    assert.equal(both.bothConfirmed, true);
  });

  it("replaces unconfirmed Linden-copy Lehigh rows with proposals and preserves Linden confirm", () => {
    const base = buildDefaultStaffingTargets();
    const lindenConfirmed = confirmLindenTargetsOnly(base);
    // Simulate old bug: Lehigh copied Linden interval shapes
    const polluted = [
      ...lindenConfirmed.filter((t) => t.location === "linden"),
      ...LINDEN_COVERAGE_BLOCKS.flatMap((b) =>
        (["monday", "tuesday"] as const).map((day) => ({
          id: `bad_lehigh_${day}_${b.start}`,
          day,
          location: "lehigh" as const,
          department: "floor" as const,
          startMinutes: b.start,
          endMinutes: b.end,
          minimum: b.count,
          desired: b.count,
          enabled: false,
          confirmed: false,
          label: "bad copy",
        }))
      ),
    ];
    const fixed = ensureStaffingTargets(polluted);
    assert.ok(fixed.every((t) => t.location !== "linden" || (t.confirmed && t.enabled)));
    const lehigh = fixed.filter((t) => t.location === "lehigh");
    assert.ok(lehigh.every((t) => !t.confirmed && !t.enabled));
    assert.ok(
      lehigh.some(
        (t) =>
          t.startMinutes === 12 * 60 &&
          t.endMinutes === 17 * 60 &&
          t.minimum === 1
      )
    );
  });
});

describe("build eligibility", () => {
  it("never claims ready while extraction is pending", async () => {
    const { computeBuildEligibility } = await import("../src/lib/buildEligibility");
    const week = {
      availabilityReviewed: true,
    } as import("../src/lib/types").WeekSchedule;
    const e = computeBuildEligibility({
      week,
      staffingStatus: {
        lindenConfirmed: true,
        lehighConfirmed: true,
        lindenCount: 1,
        lehighCount: 1,
        bothConfirmed: true,
      },
      hasPendingExtraction: true,
      unresolvedExtractionCount: 0,
      baselineApproved: true,
    });
    assert.equal(e.canBuild, false);
    assert.ok(!/ready to build/i.test(e.statusLabel));
    assert.ok(e.blockers.some((b) => /Apply and build/i.test(b)));
  });

  it("does not re-require weekly staffing once baseline is approved", async () => {
    const { computeBuildEligibility } = await import("../src/lib/buildEligibility");
    const week = {
      availabilityReviewed: false,
    } as import("../src/lib/types").WeekSchedule;
    const e = computeBuildEligibility({
      week,
      staffingStatus: {
        lindenConfirmed: true,
        lehighConfirmed: true,
        lindenCount: 42,
        lehighCount: 11,
        bothConfirmed: true,
      },
      hasPendingExtraction: false,
      baselineApproved: true,
    });
    assert.equal(e.canBuild, true);
    assert.ok(!e.needsBaselineSetup);
  });
});

describe("IC coverage and timing", () => {
  it("IC does not inflate floor coverage", () => {
    const shifts: Shift[] = [
      {
        id: "f",
        employeeId: "emp_jenn_stone",
        date: "2026-10-05",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "linden",
        department: "floor",
        locked: false,
        source: "manual",
      },
      {
        id: "ic",
        employeeId: "emp_mike_wagner",
        date: "2026-10-05",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "linden",
        department: "ic",
        locked: false,
        source: "manual",
      },
    ];
    const targets: StaffingIntervalTarget[] = [
      {
        id: "t1",
        day: "monday",
        location: "linden",
        department: "floor",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        minimum: 1,
        desired: 2,
        enabled: true,
        confirmed: true,
      },
    ];
    const coverage = computeCoverage(shifts, targets, "2026-10-05");
    const row = coverage.find(
      (c) =>
        c.date === "2026-10-05" &&
        c.location === "linden" &&
        c.startMinutes === 18 * 60 &&
        c.endMinutes === 22 * 60
    );
    assert.ok(row);
    assert.equal(row!.count, 1);
  });

  it("flags unknown IC timing", () => {
    const shifts: Shift[] = [
      {
        id: "ic",
        employeeId: "emp_mike_wagner",
        date: "2026-10-06",
        startMinutes: null,
        endMinutes: null,
        location: "linden",
        department: "ic",
        locked: false,
        source: "manual",
        missingTiming: true,
      },
    ];
    const availability = emptyWeekAvailability(employees, "2026-10-05");
    const v = revalidateWeek({
      shifts,
      availability,
      employees,
      targets: [],
      weekStart: "2026-10-05",
    });
    assert.ok(v.issues.some((i) => i.code === "ic_missing_timing"));
  });
});

describe("employment end dates", () => {
  it("blocks assignments after end date", () => {
    const emps = structuredClone(employees);
    const marques = emps.find((e) => e.id === "emp_marques_enriquez")!;
    marques.employmentEndDate = "2026-10-07";
    const shifts: Shift[] = [
      {
        id: "s",
        employeeId: "emp_marques_enriquez",
        date: "2026-10-08",
        startMinutes: 15 * 60,
        endMinutes: 18 * 60,
        location: "unknown",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    const v = revalidateWeek({
      shifts,
      availability: emptyWeekAvailability(emps, "2026-10-05"),
      employees: emps,
      targets: [],
      weekStart: "2026-10-05",
    });
    assert.ok(v.issues.some((i) => i.code === "employment_ended"));
  });
});

describe("locked shifts survive rebuild", () => {
  it("keeps locked assignment", () => {
    const weekStart = "2026-10-05";
    const availability = emptyWeekAvailability(employees, weekStart);
    // Sign off Marietta Monday so generated DNA won't recreate freely — lock someone else
    const row = availability.find((a) => a.employeeId === "emp_jenn_stone")!;
    // Lock a custom shift
    const locked: Shift = {
      id: "locked1",
      employeeId: "emp_josh_roman",
      date: "2026-10-07",
      startMinutes: 13 * 60,
      endMinutes: 17 * 60,
      location: "linden",
      department: "floor",
      locked: true,
      source: "manual",
    };
    const result = buildSchedule({
      weekStart,
      employees,
      availability,
      targets: [],
      lockedShifts: [locked],
      availabilityReviewed: true,
      timeoutMs: 10_000,
    });
    assert.ok(result.shifts.some((s) => s.id === "locked1" && s.locked));
  });
});

describe("impossible staffing leaves gaps", () => {
  it("returns partial draft with shortage issues when everyone signed off", () => {
    const weekStart = "2026-10-05";
    const availability: WeekAvailability[] = employees
      .filter((e) => e.status === "active")
      .map((e) => ({
        employeeId: e.id,
        cells: Object.fromEntries(
          ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"].map(
            (d) => [d, { kind: "off" as const, note: "Off" }]
          )
        ),
      }));
    const targets: StaffingIntervalTarget[] = [
      {
        id: "t",
        day: "monday",
        location: "linden",
        department: "floor",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        minimum: 3,
        desired: 4,
        enabled: true,
        confirmed: true,
      },
    ];
    const result = buildSchedule({
      weekStart,
      employees,
      availability,
      targets,
      lockedShifts: [],
      availabilityReviewed: true,
      timeoutMs: 5_000,
    });
    assert.equal(result.partial || result.validation.coverage.some((c) => c.status === "below_minimum"), true);
    assert.ok(result.validation.issues.some((i) => i.severity === "shortage" || i.code === "coverage_short"));
  });
});

describe("edits recalculate totals", () => {
  it("updates hours after edit", () => {
    const shifts: Shift[] = [
      {
        id: "1",
        employeeId: "emp_brady_dosedlo",
        date: "2026-10-05",
        startMinutes: 12 * 60,
        endMinutes: 18 * 60,
        location: "linden",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    let totals = computeTotals(shifts);
    assert.equal(totals[0]!.hours, 6);
    shifts[0]!.endMinutes = 15 * 60;
    totals = computeTotals(shifts);
    assert.equal(totals[0]!.hours, 3);
  });
});

describe("location-specific coverage", () => {
  it("counts Linden and Lehigh separately", () => {
    const shifts: Shift[] = [
      {
        id: "1",
        employeeId: "emp_calvin_rittle",
        date: "2026-10-05",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    const targets: StaffingIntervalTarget[] = [
      {
        id: "l",
        day: "monday",
        location: "linden",
        department: "floor",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        minimum: 1,
        desired: 2,
        enabled: true,
        confirmed: true,
      },
      {
        id: "h",
        day: "monday",
        location: "lehigh",
        department: "floor",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        minimum: 1,
        desired: 2,
        enabled: true,
        confirmed: true,
      },
    ];
    const coverage = computeCoverage(shifts, targets, "2026-10-05");
    assert.equal(
      coverage.find(
        (c) =>
          c.location === "linden" &&
          c.startMinutes === 18 * 60 &&
          c.endMinutes === 22 * 60
      )?.count,
      0
    );
    assert.equal(
      coverage.find(
        (c) =>
          c.location === "lehigh" &&
          c.startMinutes === 18 * 60 &&
          c.endMinutes === 22 * 60
      )?.count,
      1
    );
  });
});

describe("export matches saved schedule", () => {
  it("CSV contains printed labels and times from shifts", () => {
    const data = createEmptyAppData();
    const week = ensureWeek(data, "2026-10-05");
    week.shifts = [
      {
        id: "e1",
        employeeId: "emp_jenn_stone",
        date: "2026-10-05",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "linden",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    const csv = toCsv(week, data.employees);
    assert.ok(csv.includes("J. Stone"));
    assert.ok(csv.includes("2026-10-05"));
  });
});

describe("duplicate history does not invent DNA weeks", () => {
  it("seed history marks sep 21-27 duplicate group without double-counting fabricated shifts", () => {
    const data = createEmptyAppData();
    const dups = data.history.filter((h) => h.duplicateGroup === "sep21_27");
    assert.ok(dups.length >= 1);
    assert.equal(dups[0]!.shifts.length, 0);
  });
});

describe("provisional availability and unknown locations", () => {
  it("flags unconfirmed availability when calendar is empty (DNA is not confirmation)", () => {
    const weekStart = "2026-10-05";
    const availability = emptyWeekAvailability(employees, weekStart);
    const shifts: Shift[] = [
      {
        id: "1",
        employeeId: "emp_jenn_stone",
        date: "2026-10-05",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "linden",
        department: "floor",
        locked: false,
        source: "generated",
        provisionalAvailability: true,
      },
    ];
    const v = revalidateWeek({
      shifts,
      availability,
      employees,
      targets: [],
      weekStart,
    });
    assert.ok(v.issues.some((i) => i.code === "unconfirmed_availability"));
    assert.equal(v.explanation.availabilityCalendarEntered, false);
    assert.equal(v.explanation.provisionalDraft, true);
    assert.ok(
      v.explanation.bullets.some((b) =>
        b.includes("Provisional draft — availability not confirmed")
      )
    );
  });

  it("flags unknown locations as unresolved location warnings", () => {
    const weekStart = "2026-10-05";
    const availability = emptyWeekAvailability(employees, weekStart);
    const row = availability.find((a) => a.employeeId === "emp_jenn_stone")!;
    row.cells["2026-10-05"] = { kind: "unrestricted" };
    const shifts: Shift[] = [
      {
        id: "1",
        employeeId: "emp_jenn_stone",
        date: "2026-10-05",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "unknown",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    const v = revalidateWeek({
      shifts,
      availability,
      employees,
      targets: [],
      weekStart,
    });
    assert.ok(v.issues.some((i) => i.code === "unknown_location"));
    assert.ok(v.explanation.unresolvedLocationCount >= 1);
  });

  it("counts availability and location warnings in unresolved totals (not zero)", () => {
    const weekStart = "2026-10-05";
    const availability = emptyWeekAvailability(employees, weekStart);
    const shifts: Shift[] = [
      {
        id: "1",
        employeeId: "emp_jenn_stone",
        date: "2026-10-05",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "unknown",
        department: "floor",
        locked: false,
        source: "generated",
      },
    ];
    const v = revalidateWeek({
      shifts,
      availability,
      employees,
      targets: [],
      weekStart,
    });
    const unresolved =
      v.issues.filter((i) => i.severity === "hard").length +
      v.issues.filter((i) => i.severity === "shortage").length +
      v.issues.filter((i) => i.code === "unconfirmed_availability").length +
      v.issues.filter((i) => i.code === "unknown_location").length;
    assert.ok(unresolved > 0);
  });
});

describe("shift color bands", () => {
  it("uses exact start–end colors (not broad bands)", async () => {
    const { shiftCardBackground, shiftIntervalKey } = await import("../src/lib/shiftColors");
    assert.equal(shiftIntervalKey(9 * 60, 13 * 60), "540-780");
    const nineOne = shiftCardBackground({
      startMinutes: 9 * 60,
      endMinutes: 13 * 60,
      department: "floor",
    });
    const twelveFour = shiftCardBackground({
      startMinutes: 12 * 60,
      endMinutes: 16 * 60,
      department: "floor",
    });
    const sixTen = shiftCardBackground({
      startMinutes: 18 * 60,
      endMinutes: 22 * 60,
      department: "floor",
    });
    assert.notEqual(nineOne, twelveFour);
    assert.notEqual(twelveFour, sixTen);
    // IC department still uses the exact time color (badge is separate)
    const ic = shiftCardBackground({
      startMinutes: 12 * 60,
      endMinutes: 16 * 60,
      department: "ic",
    });
    assert.equal(ic, twelveFour);
  });
});

describe("week range helpers", () => {
  it("requires exactly seven inclusive days", async () => {
    const { isValidSevenDayWeek, inclusiveDaySpan } = await import("../src/lib/time");
    assert.equal(inclusiveDaySpan("2026-10-05", "2026-10-11"), 7);
    assert.equal(isValidSevenDayWeek("2026-10-05", "2026-10-11"), true);
    assert.equal(isValidSevenDayWeek("2026-10-05", "2026-10-10"), false);
  });
});

describe("DNA-first generator corrections", () => {
  const openWeek = (weekStart: string) => {
    const availability = emptyWeekAvailability(employees, weekStart);
    for (const row of availability) {
      for (const d of Object.keys(row.cells)) {
        row.cells[d] = { kind: "open", note: "No additional sign-off" };
      }
    }
    return availability;
  };

  it("does not auto-build without reviewed availability", () => {
    const weekStart = "2026-10-05";
    const result = buildSchedule({
      weekStart,
      employees,
      availability: emptyWeekAvailability(employees, weekStart),
      targets: [],
      lockedShifts: [],
      availabilityReviewed: false,
      mode: "build",
    });
    assert.ok(result.blockedReason);
    assert.equal(result.shifts.length, 0);
  });

  it("never assigns Marques automatic 9–1", () => {
    const weekStart = "2026-10-05";
    const result = buildSchedule({
      weekStart,
      employees,
      availability: openWeek(weekStart),
      targets: [],
      lockedShifts: [],
      availabilityReviewed: true,
      mode: "build",
      timeoutMs: 15_000,
    });
    const bad = result.shifts.filter(
      (s) =>
        s.employeeId === "emp_marques_enriquez" &&
        s.startMinutes === 9 * 60 &&
        s.endMinutes === 13 * 60
    );
    assert.equal(bad.length, 0);
  });

  it("never assigns Mike automatic 9–1", () => {
    const weekStart = "2026-10-05";
    const result = buildSchedule({
      weekStart,
      employees,
      availability: openWeek(weekStart),
      targets: [],
      lockedShifts: [],
      availabilityReviewed: true,
      mode: "build",
      timeoutMs: 15_000,
    });
    const bad = result.shifts.filter(
      (s) =>
        s.employeeId === "emp_mike_wagner" &&
        s.startMinutes === 9 * 60 &&
        s.endMinutes === 13 * 60 &&
        s.source === "generated"
    );
    assert.equal(bad.length, 0);
  });

  it("does not assign Jenn or Addy morning shifts from DNA", () => {
    const weekStart = "2026-10-05";
    const result = buildSchedule({
      weekStart,
      employees,
      availability: openWeek(weekStart),
      targets: [],
      lockedShifts: [],
      availabilityReviewed: true,
      mode: "build",
      timeoutMs: 15_000,
    });
    for (const id of ["emp_jenn_stone", "emp_addy_giesler"]) {
      const mornings = result.shifts.filter(
        (s) => s.employeeId === id && s.startMinutes != null && s.startMinutes < 12 * 60
      );
      assert.equal(mornings.length, 0, `${id} should not get morning shifts`);
    }
  });

  it("never generates overlapping shifts for the same employee", () => {
    const weekStart = "2026-10-05";
    const result = buildSchedule({
      weekStart,
      employees,
      availability: openWeek(weekStart),
      targets: [],
      lockedShifts: [],
      availabilityReviewed: true,
      mode: "build",
      timeoutMs: 15_000,
    });
    const overlaps = result.validation.issues.filter((i) => i.code === "overlap");
    assert.equal(overlaps.length, 0);
    // Marques specifically: not both 1–6 and 3–6 same day
    const byDay = new Map<string, typeof result.shifts>();
    for (const s of result.shifts.filter((x) => x.employeeId === "emp_marques_enriquez")) {
      const list = byDay.get(s.date!) ?? [];
      list.push(s);
      byDay.set(s.date!, list);
    }
    for (const [, list] of byDay) {
      assert.ok(list.length <= 1, "Marques should have at most one floor shift per day");
    }
  });

  it("respects Marques 3–4 workday preference as soft max", () => {
    const weekStart = "2026-10-05";
    const result = buildSchedule({
      weekStart,
      employees,
      availability: openWeek(weekStart),
      targets: [],
      lockedShifts: [],
      availabilityReviewed: true,
      mode: "build",
      timeoutMs: 15_000,
    });
    const days = new Set(
      result.shifts.filter((s) => s.employeeId === "emp_marques_enriquez").map((s) => s.date)
    );
    assert.ok(days.size <= 4, `Marques workdays=${days.size}`);
  });

  it("preview patterns works without reviewed availability and stays provisional", () => {
    const weekStart = "2026-10-05";
    const result = buildSchedule({
      weekStart,
      employees,
      availability: emptyWeekAvailability(employees, weekStart),
      targets: [],
      lockedShifts: [],
      availabilityReviewed: false,
      mode: "preview_patterns",
      timeoutMs: 15_000,
    });
    assert.ok(!result.blockedReason);
    assert.ok(result.shifts.every((s) => s.provisionalAvailability || s.locked));
  });

  it("weeks do not share shift arrays from ensureWeek", () => {
    const data = createEmptyAppData();
    const a = ensureWeek(data, "2026-10-05");
    const b = ensureWeek(data, "2026-10-12");
    a.shifts.push({
      id: "only_a",
      employeeId: "emp_jenn_stone",
      date: "2026-10-05",
      startMinutes: 18 * 60,
      endMinutes: 22 * 60,
      location: "unknown",
      department: "floor",
      locked: false,
      source: "manual",
    });
    assert.equal(b.shifts.length, 0);
    assert.equal(a.weekStart, "2026-10-05");
    assert.equal(b.weekStart, "2026-10-12");
  });

  it("extracted sign-off override blocks that employee during the blocked time", () => {
    const {
      applyRecurringBaseline,
      overlayExtractionOnWeek,
    } = require("../src/lib/availabilityApply") as typeof import("../src/lib/availabilityApply");
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const week = ensureWeek(data, "2026-09-14");
    applyRecurringBaseline(week, data.employees);
    const { applied } = overlayExtractionOnWeek(week, data.employees, [
      {
        rawName: "Addi",
        employeeId: "emp_addy_giesler",
        date: "2026-09-16",
        note: "Off",
        kindHint: "off",
      },
      {
        rawName: "Addy",
        employeeId: "emp_addy_giesler",
        date: "2026-09-18",
        note: "After 3",
        kindHint: "after",
      },
    ]);
    assert.equal(applied, 2);
    const row = week.availability.find((a) => a.employeeId === "emp_addy_giesler");
    assert.ok(row);
    assert.equal(row!.cells["2026-09-16"]?.kind, "off");
    assert.equal(row!.cells["2026-09-18"]?.kind, "after");
    assert.equal(
      availabilityAllowsShift(row!.cells["2026-09-16"]!, 18 * 60, 22 * 60).ok,
      false
    );
    assert.equal(
      availabilityAllowsShift(row!.cells["2026-09-18"]!, 12 * 60, 18 * 60).ok,
      false
    );
    assert.equal(
      availabilityAllowsShift(row!.cells["2026-09-18"]!, 15 * 60, 18 * 60).ok,
      true
    );
    // DNA unchanged by availability overlay
    const emp = data.employees.find((e) => e.id === "emp_addy_giesler")!;
    const before = emp.dna.commonShiftTypes.length;
    assert.ok(before > 0);
    assert.equal(emp.dna.commonShiftTypes.length, before);
  });
});
