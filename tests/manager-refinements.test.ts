import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyAppData, ensureWeek } from "../src/lib/fixtures/appData";
import { applyManagerDnaCorrections } from "../src/lib/dnaCorrections";
import {
  applySep14ManagerCorrections,
  sep14VerifiedOffMap,
  SEP14_TEST_WEEK,
} from "../src/lib/managerWeekCorrections";
import { formatCompactEmployeeName } from "../src/lib/displayName";
import { resolveEmployeeName } from "../src/lib/names";
import { buildSeedEmployees } from "../src/lib/seed/employees";
import { buildSchedule } from "../src/lib/scheduler";
import {
  buildDefaultStaffingTargets,
  confirmLindenTargetsOnly,
  confirmLehighTargetsOnly,
} from "../src/lib/staffingTargets";
import { weekDates } from "../src/lib/time";

const employees = buildSeedEmployees();
applyManagerDnaCorrections(employees);

describe("Sep 14–20 manager-verified sign-offs", () => {
  it("applies exact verified Xs for Addison, Alexis, Calvin, Jordan", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    ensureWeek(data, SEP14_TEST_WEEK);
    // Seed a false Addison Tuesday photo X to prove correction clears it
    const addy = data.weeks[0]!.availability.find((a) => a.employeeId === "emp_addy_giesler")!;
    addy.cells["2026-09-15"] = { kind: "off", note: "Off", source: "photo" };

    const { mutated } = applySep14ManagerCorrections(data);
    assert.equal(mutated, true);
    const map = sep14VerifiedOffMap();
    for (const [empId, dates] of Object.entries(map)) {
      const row = data.weeks[0]!.availability.find((a) => a.employeeId === empId)!;
      for (const d of dates) {
        assert.equal(row.cells[d]?.kind, "off", `${empId} ${d}`);
        assert.equal(row.cells[d]?.source, "manual", `${empId} ${d} source`);
      }
    }
    assert.notEqual(addy.cells["2026-09-15"]?.kind, "off");
  });

  it("Jordan has seven offs and receives no generated assignments that week", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    ensureWeek(data, SEP14_TEST_WEEK);
    applySep14ManagerCorrections(data);
    const week = data.weeks.find((w) => w.weekStart === SEP14_TEST_WEEK)!;
    const jordan = week.availability.find((a) => a.employeeId === "emp_josh_roman")!;
    for (const d of weekDates(SEP14_TEST_WEEK)) {
      assert.equal(jordan.cells[d]?.kind, "off", d);
    }
    const targets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    const result = buildSchedule({
      weekStart: SEP14_TEST_WEEK,
      employees: data.employees,
      availability: week.availability,
      targets,
      lockedShifts: [],
      settings: data.settings,
      mode: "build",
      availabilityReviewed: true,
      timeoutMs: 20_000,
    });
    assert.equal(
      result.shifts.filter((s) => s.employeeId === "emp_josh_roman").length,
      0
    );
  });

  it("does not create a John employee", () => {
    assert.ok(!employees.some((e) => /john/i.test(e.displayName) && e.id !== "emp_josh_roman"));
    assert.ok(!employees.some((e) => e.id === "emp_john"));
  });

  it("new weeks do not inherit Sep 14 test sign-offs", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    ensureWeek(data, SEP14_TEST_WEEK);
    applySep14ManagerCorrections(data);
    const other = ensureWeek(data, "2026-09-28");
    const jordan = other.availability.find((a) => a.employeeId === "emp_josh_roman")!;
    for (const d of weekDates("2026-09-28")) {
      assert.notEqual(jordan.cells[d]?.kind, "off");
    }
  });
});

describe("Mike auto-schedule exclusion", () => {
  it("never auto-assigns Mike", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const mike = data.employees.find((e) => e.id === "emp_mike_wagner")!;
    assert.equal(mike.autoScheduleEnabled, false);
    const week = ensureWeek(data, "2026-09-28");
    for (const row of week.availability) {
      for (const d of Object.keys(row.cells)) {
        row.cells[d] = {
          kind: "window",
          window: { startMinutes: 12 * 60, endMinutes: 22 * 60 },
          source: "manual",
        };
      }
    }
    const targets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
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
    assert.equal(
      result.shifts.filter((s) => s.employeeId === "emp_mike_wagner").length,
      0
    );
  });

  it("preserves locked manual Mike shifts", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const week = ensureWeek(data, "2026-09-28");
    for (const row of week.availability) {
      for (const d of Object.keys(row.cells)) {
        row.cells[d] = {
          kind: "window",
          window: { startMinutes: 12 * 60, endMinutes: 22 * 60 },
          source: "manual",
        };
      }
    }
    const locked = {
      id: "mike_manual",
      employeeId: "emp_mike_wagner",
      date: "2026-09-28",
      startMinutes: 18 * 60,
      endMinutes: 22 * 60,
      location: "linden" as const,
      department: "ic" as const,
      locked: true,
      source: "manual" as const,
    };
    const targets = confirmLindenTargetsOnly(buildDefaultStaffingTargets());
    const result = buildSchedule({
      weekStart: week.weekStart,
      employees: data.employees,
      availability: week.availability,
      targets,
      lockedShifts: [locked],
      settings: data.settings,
      mode: "build",
      availabilityReviewed: true,
      timeoutMs: 15_000,
    });
    assert.ok(result.shifts.some((s) => s.id === "mike_manual" && s.employeeId === "emp_mike_wagner"));
  });
});

describe("compact display names", () => {
  it("formats first + last initial and Brady suffixes without changing IDs", () => {
    const marques = employees.find((e) => e.id === "emp_marques_enriquez")!;
    const jordan = employees.find((e) => e.id === "emp_josh_roman")!;
    const dos = employees.find((e) => e.id === "emp_brady_dosedlo")!;
    const dol = employees.find((e) => e.id === "emp_brady_dologite")!;
    const kourtney = employees.find((e) => e.id === "emp_kourtney_cantrel")!;
    const jenn = employees.find((e) => e.id === "emp_jenn_stone")!;
    assert.equal(formatCompactEmployeeName(marques), "Marques E.");
    assert.equal(formatCompactEmployeeName(jordan), "Jordan R.");
    assert.equal(formatCompactEmployeeName(dos), "Brady Dos.");
    assert.equal(formatCompactEmployeeName(dol), "Brady Dol.");
    assert.equal(formatCompactEmployeeName(kourtney), "Kourtney C.");
    assert.equal(formatCompactEmployeeName(jenn), "Jenn S.");
    assert.notEqual(dos.id, dol.id);
  });
});

describe("John / Jordan identity", () => {
  it("John suggests Jordan as possible match without creating employee", () => {
    const r = resolveEmployeeName("John", employees);
    assert.equal(r.status, "ambiguous");
    assert.deepEqual(r.employeeIds, ["emp_josh_roman"]);
    assert.equal(r.reviewHeadline, "Possible match: Jordan R.");
    assert.ok(!employees.some((e) => e.id === "emp_john"));
  });

  it("Addy and Addi resolve to Addison", () => {
    for (const q of ["Addy", "Addi", "Addison"]) {
      const r = resolveEmployeeName(q, employees);
      assert.equal(r.status, "exact", q);
      assert.deepEqual(r.employeeIds, ["emp_addy_giesler"], q);
    }
  });
});
