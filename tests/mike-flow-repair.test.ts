import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  splitSuspiciousCombinedNames,
  isNonIdentityRawName,
} from "../src/lib/splitCombinedNames";
import { consolidateMarksByLocation } from "../src/lib/ocrMarkUtils";
import { buildSeedEmployees } from "../src/lib/seed/employees";
import { applyManagerDnaCorrections } from "../src/lib/dnaCorrections";
import {
  overlayExtractionOnWeek,
  cellFromExtractionEntry,
} from "../src/lib/availabilityApply";
import { createEmptyAppData, ensureWeek } from "../src/lib/fixtures/appData";
import { resolveEmployeeName } from "../src/lib/names";
import { dayOfWeekFromDate, thisWeekMondayNy, todayInNewYork, mondayOf } from "../src/lib/time";
import { format } from "date-fns";
import {
  availabilityAllowsShift,
  computeCoverage,
  revalidateWeek,
} from "../src/lib/validation";
import { buildSchedule } from "../src/lib/scheduler";
import {
  confirmLindenTargetsOnly,
  confirmLehighTargetsOnly,
  buildDefaultStaffingTargets,
} from "../src/lib/staffingTargets";
import type { Shift } from "../src/lib/types";

const employees = buildSeedEmployees();
applyManagerDnaCorrections(employees);

describe("combined name splitting", () => {
  it("splits Addison Jordan Jenn into three individual entries", () => {
    const out = splitSuspiciousCombinedNames(
      [
        {
          rawName: "Addison Jordan Jenn",
          date: "2026-09-17",
          kindHint: "off",
        },
      ],
      employees
    );
    assert.equal(out.length, 3);
    const names = out.map((e) => e.rawName);
    assert.ok(names.includes("Addison"));
    assert.ok(names.includes("Jordan"));
    assert.ok(names.includes("Jenn"));
    assert.ok(out.every((e) => e.date === "2026-09-17"));
    assert.equal(out.find((e) => e.rawName === "Addison")?.employeeIds?.[0], "emp_addy_giesler");
    assert.equal(out.find((e) => e.rawName === "Jenn")?.employeeIds?.[0], "emp_jenn_stone");
    assert.equal(out.find((e) => e.rawName === "Jordan")?.employeeIds?.[0], "emp_josh_roman");
    assert.equal(out.find((e) => e.rawName === "Jordan")?.matchStatus, "exact");
  });

  it("splits Marques Jordan Jenn with Jordan → Jordan Roman", () => {
    const out = splitSuspiciousCombinedNames(
      [{ rawName: "Marques Jordan Jenn", date: "2026-09-18", kindHint: "off" }],
      employees
    );
    assert.equal(out.length, 3);
    const marques = out.find((e) => e.rawName === "Marques");
    const jenn = out.find((e) => e.rawName === "Jenn");
    const jordan = out.find((e) => e.rawName === "Jordan");
    assert.equal(marques?.employeeIds?.[0], "emp_marques_enriquez");
    assert.equal(jenn?.employeeIds?.[0], "emp_jenn_stone");
    assert.equal(jordan?.employeeIds?.[0], "emp_josh_roman");
    assert.equal(jordan?.matchStatus, "exact");
  });

  it("keeps full names intact when tokens are not all unique first names", () => {
    const out = splitSuspiciousCombinedNames(
      [{ rawName: "Brady Dosedlo", date: "2026-09-15", kindHint: "off" }],
      employees
    );
    assert.equal(out.length, 1);
    assert.equal(out[0]!.rawName, "Brady Dosedlo");
  });

  it("does not treat crossed out as an employee identity", () => {
    assert.equal(isNonIdentityRawName("crossed out"), true);
    assert.equal(isNonIdentityRawName("Marques"), false);
    const r = resolveEmployeeName("crossed out", employees);
    assert.equal(r.status, "unknown");
  });
});

describe("calendar date mapping", () => {
  it("maps Thursday ISO date to thursday weekday", () => {
    assert.equal(dayOfWeekFromDate("2026-09-17"), "thursday");
  });

  it("Monday-first week dates put Sunday last", () => {
    const start = "2026-09-14";
    assert.equal(dayOfWeekFromDate(start), "monday");
    assert.equal(dayOfWeekFromDate("2026-09-20"), "sunday");
  });

  it("this week uses America/New_York current date, not a hardcoded September", () => {
    const today = todayInNewYork();
    const monday = thisWeekMondayNy();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(monday, format(mondayOf(today), "yyyy-MM-dd"));
    // Must not be permanently stuck on demo week unless today really is that week
    if (!today.startsWith("2026-09")) {
      assert.notEqual(monday, "2026-09-14");
    }
  });
});

describe("photo replace vs accumulate", () => {
  it("replacement photo clears prior photo sign-offs but keeps manual", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const week = ensureWeek(data, "2026-10-05");
    overlayExtractionOnWeek(
      week,
      data.employees,
      [
        {
          rawName: "Marques",
          employeeId: "emp_marques_enriquez",
          date: "2026-10-06",
          kindHint: "off",
        },
      ],
      { replacePhoto: true }
    );
    const row = week.availability.find((a) => a.employeeId === "emp_marques_enriquez")!;
    assert.equal(row.cells["2026-10-06"]?.kind, "off");
    assert.equal(row.cells["2026-10-06"]?.source, "photo");

    // Manual edit
    const mike = week.availability.find((a) => a.employeeId === "emp_mike_wagner")!;
    mike.cells["2026-10-07"] = { kind: "off", note: "Off", source: "manual" };

    // New photo without Marques — must clear old photo X, keep Mike manual
    overlayExtractionOnWeek(
      week,
      data.employees,
      [
        {
          rawName: "Addison",
          employeeId: "emp_addy_giesler",
          date: "2026-10-08",
          kindHint: "off",
        },
      ],
      { replacePhoto: true }
    );
    assert.equal(row.cells["2026-10-06"], undefined);
    assert.equal(mike.cells["2026-10-07"]?.source, "manual");
    assert.equal(mike.cells["2026-10-07"]?.kind, "off");
    const addy = week.availability.find((a) => a.employeeId === "emp_addy_giesler")!;
    assert.equal(addy.cells["2026-10-08"]?.kind, "off");
  });

  it("absent employees still have availability rows in empty week", () => {
    const data = createEmptyAppData();
    const week = ensureWeek(data, "2026-10-12");
    const active = data.employees.filter((e) => e.status === "active");
    assert.ok(active.length >= 10);
    for (const emp of active) {
      assert.ok(
        week.availability.some((a) => a.employeeId === emp.id),
        `missing row for ${emp.displayName}`
      );
    }
  });
});

describe("identity corrections", () => {
  it("resolves Jen and Jenn to the same verified person", () => {
    const a = resolveEmployeeName("Jen", employees);
    const b = resolveEmployeeName("Jenn", employees);
    assert.equal(a.status, "exact");
    assert.equal(b.status, "exact");
    assert.deepEqual(a.employeeIds, ["emp_jenn_stone"]);
    assert.deepEqual(b.employeeIds, ["emp_jenn_stone"]);
  });

  it("does not invent Josh as required for J. Roman", () => {
    const emp = employees.find((e) => e.id === "emp_josh_roman")!;
    assert.equal(emp.displayName, "Jordan Roman");
    assert.equal(emp.firstName, "Jordan");
    assert.equal(emp.firstNameConfirmed, true);
    assert.ok(emp.aliases.some((a) => a.alias === "Jordan" && a.confirmed));
    assert.ok(emp.aliases.some((a) => a.alias === "J. Roman" && a.confirmed));
    assert.ok(!emp.aliases.some((a) => /^josh$/i.test(a.alias)));
  });

  it("resolves Jordan and J. Roman to the same employee", () => {
    const a = resolveEmployeeName("Jordan", employees);
    const b = resolveEmployeeName("J. Roman", employees);
    const c = resolveEmployeeName("Jordan Roman", employees);
    assert.equal(a.status, "exact");
    assert.equal(b.status, "exact");
    assert.equal(c.status, "exact");
    assert.deepEqual(a.employeeIds, ["emp_josh_roman"]);
    assert.deepEqual(b.employeeIds, ["emp_josh_roman"]);
    assert.deepEqual(c.employeeIds, ["emp_josh_roman"]);
  });

  it("never maps John silently; suggests Jordan for review", () => {
    const r = resolveEmployeeName("John", employees);
    assert.equal(r.status, "ambiguous");
    assert.deepEqual(r.employeeIds, ["emp_josh_roman"]);
  });

  it("resolves Thomas and Tommy to Tom DeAngelis", () => {
    for (const q of ["Thomas", "Tommy", "Tom", "T. DeAngelis"]) {
      const r = resolveEmployeeName(q, employees);
      assert.equal(r.status, "exact", q);
      assert.deepEqual(r.employeeIds, ["emp_tom_deangelis"], q);
    }
  });

  it("keeps Lexi and Brooke separate", () => {
    assert.equal(resolveEmployeeName("Lexi", employees).status, "exact");
    assert.equal(resolveEmployeeName("Brooke", employees).status, "exact");
    assert.notDeepEqual(
      resolveEmployeeName("Lexi", employees).employeeIds,
      resolveEmployeeName("Brooke", employees).employeeIds
    );
  });
});

describe("scheduling hard constraints", () => {
  it("full-day off blocks all assignments that day", () => {
    assert.equal(availabilityAllowsShift({ kind: "off" }, 12 * 60, 18 * 60).ok, false);
  });

  it("partial after-5 blocks earlier coverage", () => {
    const cell = cellFromExtractionEntry({ note: "After 5", kindHint: "after" });
    assert.equal(cell.kind, "after");
    assert.equal(availabilityAllowsShift(cell, 12 * 60, 18 * 60).ok, false);
  });

  it("Marques is never assigned 9–1 by the generator", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const targets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    data.staffingTargets = targets;
    data.settings.baselineApprovedAt = new Date().toISOString();
    const week = ensureWeek(data, "2026-10-05");
    // Open windows for Marques afternoon only via photo after
    for (const row of week.availability) {
      for (const d of Object.keys(row.cells)) {
        row.cells[d] = { kind: "window", window: { startMinutes: 12 * 60, endMinutes: 22 * 60 }, source: "manual" };
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
      timeoutMs: 20_000,
    });
    const bad = result.shifts.filter(
      (s) =>
        s.employeeId === "emp_marques_enriquez" &&
        s.startMinutes === 9 * 60 &&
        s.endMinutes === 13 * 60
    );
    assert.equal(bad.length, 0);
  });

  it("coverage distinguishes 6–10 vs 7–10", () => {
    const targets = confirmLindenTargetsOnly(buildDefaultStaffingTargets());
    const shifts: Shift[] = [
      {
        id: "s1",
        employeeId: "emp_dante_smith",
        date: "2026-10-05",
        startMinutes: 19 * 60,
        endMinutes: 22 * 60,
        location: "linden",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    const coverage = computeCoverage(shifts, targets, "2026-10-05");
    // Opening-hours split: look at concurrent count across 6–7 (uncovered) vs 7–10 (covered)
    const sixToSeven = coverage.find(
      (c) =>
        c.date === "2026-10-05" &&
        c.location === "linden" &&
        c.startMinutes === 18 * 60 &&
        c.endMinutes === 19 * 60
    );
    const sevenTen = coverage.filter(
      (c) =>
        c.date === "2026-10-05" &&
        c.location === "linden" &&
        c.startMinutes >= 19 * 60 &&
        c.endMinutes <= 22 * 60
    );
    assert.ok(sixToSeven, "6–7 segment within 6–10 must exist");
    assert.equal(sixToSeven!.count, 0);
    assert.ok(sixToSeven!.status === "below_minimum" || sixToSeven!.status === "unstaffed_open");
    assert.ok(sevenTen.some((c) => c.count >= 1), "7–10 must show the assigned person");
  });

  it("infeasible case exposes gaps without assigning signed-off people", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const targets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    const week = ensureWeek(data, "2026-10-05");
    // Everyone off Monday
    for (const row of week.availability) {
      row.cells["2026-10-05"] = { kind: "off", note: "Off", source: "manual" };
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
    const mondayShifts = result.shifts.filter((s) => s.date === "2026-10-05");
    assert.equal(mondayShifts.length, 0);
    assert.ok(result.partial || result.validation.issues.some((i) => i.severity === "shortage"));
  });

  it("manual edit revalidation updates issues", () => {
    const data = createEmptyAppData();
    const week = ensureWeek(data, "2026-10-05");
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
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    const v = revalidateWeek({
      shifts,
      availability: week.availability,
      employees: data.employees,
      targets: confirmLindenTargetsOnly(buildDefaultStaffingTargets()),
      weekStart: week.weekStart,
    });
    assert.ok(v.issues.some((i) => i.code === "overlap"));
  });
});

describe("fresh week state", () => {
  it("new week has empty shifts/issues and does not inherit another week", () => {
    const data = createEmptyAppData();
    const a = ensureWeek(data, "2026-09-14");
    a.shifts.push({
      id: "x",
      employeeId: "emp_dante_smith",
      date: "2026-09-14",
      startMinutes: 18 * 60,
      endMinutes: 22 * 60,
      location: "linden",
      department: "floor",
      locked: false,
      source: "generated",
    });
    a.issues.push({
      id: "iss",
      severity: "hard",
      code: "overlap",
      message: "stale",
      date: "2026-09-14",
    });
    const b = ensureWeek(data, "2026-10-05");
    assert.equal(b.shifts.length, 0);
    assert.equal(b.issues.length, 0);
    assert.notEqual(b.weekStart, a.weekStart);
  });
});

describe("OCR merge does not combine distinct first names", () => {
  it("keeps Addison and Jordan as separate marks when nearby", () => {
    const merged = consolidateMarksByLocation([
      { rawName: "Addison", pageX: 0.5, pageY: 0.4, source: "crop" },
      { rawName: "Jordan", pageX: 0.51, pageY: 0.45, source: "crop" },
    ]);
    assert.equal(merged.length, 2);
  });
});
