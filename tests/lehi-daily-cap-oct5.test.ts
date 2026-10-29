import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyAppData, ensureWeek } from "../src/lib/fixtures/appData";
import { applyManagerDnaCorrections } from "../src/lib/dnaCorrections";
import { formatCompactEmployeeName } from "../src/lib/displayName";
import {
  canAutoAssignToLocation,
  LEHIGH_OCCASIONAL_IDS,
} from "../src/lib/locationEligibility";
import {
  LEHIGH_MAX_DISTINCT_PER_DAY,
  lehighDistinctCount,
  canAddLehighDistinctEmployee,
} from "../src/lib/lehighDailyCap";
import { buildSchedule } from "../src/lib/scheduler";
import {
  buildDefaultStaffingTargets,
  confirmLindenTargetsOnly,
  confirmLehighTargetsOnly,
  ensureStaffingTargets,
  LEHIGH_COVERAGE_PROPOSALS,
} from "../src/lib/staffingTargets";
import { computeCoverage, revalidateWeek } from "../src/lib/validation";
import type { Shift } from "../src/lib/types";
import { newId } from "../src/lib/time";
import { OCT_5_11_2026_HISTORY } from "../src/lib/seed/oct5History";

describe("Lehi daily distinct-employee cap", () => {
  it("caps automatic Lehi at three distinct people per day", () => {
    assert.equal(LEHIGH_MAX_DISTINCT_PER_DAY, 3);
    const shifts: Shift[] = [];
    for (const id of ["a", "b", "c"]) {
      shifts.push({
        id: newId("shift"),
        employeeId: id,
        date: "2026-10-05",
        startMinutes: 12 * 60,
        endMinutes: 17 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "generated",
      });
    }
    assert.equal(lehighDistinctCount(shifts, "2026-10-05"), 3);
    assert.equal(canAddLehighDistinctEmployee(shifts, "2026-10-05", "a"), true);
    assert.equal(canAddLehighDistinctEmployee(shifts, "2026-10-05", "d"), false);
  });

  it("weekday proposals use one opener and one closer minimum (not two openers)", () => {
    const daytime = LEHIGH_COVERAGE_PROPOSALS.find(
      (p) => p.label.includes("opener") && p.days.includes("monday")
    );
    assert.ok(daytime);
    assert.equal(daytime!.count, 1);
    assert.ok(daytime!.end === 17 * 60 || daytime!.end === 18 * 60);
    const dualOpener = LEHIGH_COVERAGE_PROPOSALS.find(
      (p) => p.start === 12 * 60 && p.end === 16 * 60 && p.count >= 2
    );
    assert.equal(dualOpener, undefined);
  });

  it("generation stays within three Lehi people on a fully available week", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    data.staffingTargets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(ensureStaffingTargets(buildDefaultStaffingTargets()))
    );
    const week = ensureWeek(data, "2026-10-05");
    week.shifts = [];
    week.availabilityReviewed = true;
    for (const row of week.availability) {
      for (const d of Object.keys(row.cells)) {
        row.cells[d] = { kind: "empty", source: "manual" };
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
      timeoutMs: 20_000,
    });
    for (const date of [
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]) {
      const n = lehighDistinctCount(result.shifts, date);
      assert.ok(
        n <= LEHIGH_MAX_DISTINCT_PER_DAY,
        `${date} has ${n} Lehi people (cap ${LEHIGH_MAX_DISTINCT_PER_DAY})`
      );
    }
    assert.equal(
      result.shifts.filter((s) => s.employeeId === "emp_mike_wagner").length,
      0
    );
  });

  it("two-person Lehi package can cover weekday opening hours", () => {
    const targets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(ensureStaffingTargets(buildDefaultStaffingTargets()))
    );
    const monday = "2026-10-05";
    const shifts: Shift[] = [
      {
        id: newId("s"),
        employeeId: "emp_clausnitzer",
        date: monday,
        startMinutes: 12 * 60,
        endMinutes: 17 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "manual",
      },
      {
        id: newId("s"),
        employeeId: "emp_brady_dologite",
        date: monday,
        startMinutes: 17 * 60,
        endMinutes: 22 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    assert.equal(lehighDistinctCount(shifts, monday), 2);
    const coverage = computeCoverage(shifts, targets, monday);
    const lehi = coverage.filter((c) => c.date === monday && c.location === "lehigh");
    assert.ok(lehi.length >= 2);
    assert.ok(
      lehi.every((c) => c.count >= c.minimum || c.status === "staffing_target_missing"),
      "full open window staffed with 2 people"
    );
  });
});

describe("F. Makary / B. Clausnitzer identity display", () => {
  it("compact names use printed first-initial form", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const makary = data.employees.find((e) => e.id === "emp_makary")!;
    const claus = data.employees.find((e) => e.id === "emp_clausnitzer")!;
    assert.equal(formatCompactEmployeeName(makary), "F. Makary");
    assert.equal(formatCompactEmployeeName(claus), "B. Clausnitzer");
    assert.notEqual(formatCompactEmployeeName(makary), "Makary M.");
    assert.notEqual(formatCompactEmployeeName(claus), "Clausnitzer C.");
  });
});

describe("Dante / Alex occasional Lehi eligibility", () => {
  it("Dante and Alex may auto-assign to Lehi; Mike may not", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const dante = data.employees.find((e) => e.id === "emp_dante_smith")!;
    const alex = data.employees.find((e) => e.id === "emp_alex_cheatham")!;
    const mike = data.employees.find((e) => e.id === "emp_mike_wagner")!;
    assert.equal(canAutoAssignToLocation(dante, "lehigh"), true);
    assert.equal(canAutoAssignToLocation(alex, "lehigh"), true);
    assert.equal(canAutoAssignToLocation(mike, "lehigh"), false);
    assert.ok(LEHIGH_OCCASIONAL_IDS.has("emp_dante_smith"));
  });

  it("manual excess Lehi people is a soft override conflict, not silent", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const targets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(ensureStaffingTargets(buildDefaultStaffingTargets()))
    );
    const date = "2026-10-05";
    const shifts: Shift[] = ["a", "b", "c", "d"].map((id, i) => ({
      id: newId("s"),
      employeeId: [
        "emp_clausnitzer",
        "emp_brady_dologite",
        "emp_noah_miller",
        "emp_calvin_rittle",
      ][i]!,
      date,
      startMinutes: 12 * 60 + i * 60,
      endMinutes: 22 * 60,
      location: "lehigh" as const,
      department: "floor" as const,
      locked: false,
      source: "manual" as const,
    }));
    const v = revalidateWeek({
      shifts,
      availability: ensureWeek(data, date).availability,
      employees: data.employees,
      targets,
      weekStart: date,
    });
    assert.ok(v.issues.some((i) => i.code === "lehigh_daily_cap"));
  });
});

describe("Oct 5–11 history evidence", () => {
  it("includes Clausnitzer noon–5 L and Brady weekend 1–6 L", () => {
    assert.ok(
      OCT_5_11_2026_HISTORY.some(
        (h) =>
          h.employeeId === "emp_clausnitzer" &&
          h.raw === "12-5L" &&
          h.date === "2026-10-05"
      )
    );
    assert.ok(
      OCT_5_11_2026_HISTORY.some(
        (h) =>
          h.employeeId === "emp_brady_dologite" &&
          h.raw === "1-6L" &&
          h.date === "2026-10-11"
      )
    );
    assert.ok(
      OCT_5_11_2026_HISTORY.some(
        (h) =>
          h.employeeId === "emp_dante_smith" &&
          h.raw === "12-6L" &&
          h.location === "lehigh"
      )
    );
  });
});
