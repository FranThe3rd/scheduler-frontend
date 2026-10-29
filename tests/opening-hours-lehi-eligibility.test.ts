import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyAppData, ensureWeek } from "../src/lib/fixtures/appData";
import { applyManagerDnaCorrections } from "../src/lib/dnaCorrections";
import { openingHoursFor } from "../src/lib/openingHours";
import {
  canAutoAssignToLocation,
  LEHIGH_USUAL_IDS,
} from "../src/lib/locationEligibility";
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

describe("authoritative opening hours", () => {
  it("Main is 11 AM–10 PM every day", () => {
    for (const day of [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ] as const) {
      const h = openingHoursFor("linden", day)!;
      assert.equal(h.openMinutes, 11 * 60);
      assert.equal(h.closeMinutes, 22 * 60);
    }
  });

  it("Lehi is noon–10 weekdays and 1–10 weekends", () => {
    for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday"] as const) {
      const h = openingHoursFor("lehigh", day)!;
      assert.equal(h.openMinutes, 12 * 60);
      assert.equal(h.closeMinutes, 22 * 60);
    }
    for (const day of ["saturday", "sunday"] as const) {
      const h = openingHoursFor("lehigh", day)!;
      assert.equal(h.openMinutes, 13 * 60);
      assert.equal(h.closeMinutes, 22 * 60);
    }
  });
});

describe("Lehi opening-hours coverage cannot disappear", () => {
  function confirmedTargets() {
    return confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(ensureStaffingTargets(buildDefaultStaffingTargets()))
    );
  }

  it("Saturday Lehi 1–6 is detected when only 6–10 is staffed", () => {
    const targets = confirmedTargets();
    const saturday = "2026-09-19";
    const shifts: Shift[] = [
      {
        id: newId("shift"),
        employeeId: "emp_alex_cheatham",
        date: saturday,
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "manual",
      },
      {
        id: newId("shift"),
        employeeId: "emp_noah_miller",
        date: saturday,
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    const coverage = computeCoverage(shifts, targets, "2026-09-14");
    const daytime = coverage.filter(
      (c) =>
        c.date === saturday &&
        c.location === "lehigh" &&
        c.startMinutes >= 13 * 60 &&
        c.endMinutes <= 18 * 60
    );
    assert.ok(daytime.length > 0, "Sat daytime Lehi rows must exist");
    assert.ok(
      daytime.some((c) => c.count === 0 && (c.status === "below_minimum" || c.status === "unstaffed_open")),
      "Sat 1–6 with zero staff must be visible as short/unstaffed"
    );
    const evening = coverage.filter(
      (c) =>
        c.date === saturday &&
        c.location === "lehigh" &&
        c.startMinutes >= 18 * 60 &&
        c.endMinutes <= 22 * 60
    );
    assert.ok(evening.some((c) => c.count >= 2));
  });

  it("Sunday Lehi 6–10 is detected when only 1–6 exists", () => {
    const targets = confirmedTargets();
    const sunday = "2026-09-20";
    const shifts: Shift[] = [
      {
        id: newId("shift"),
        employeeId: "emp_brady_dologite",
        date: sunday,
        startMinutes: 13 * 60,
        endMinutes: 18 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    const coverage = computeCoverage(shifts, targets, "2026-09-14");
    const evening = coverage.filter(
      (c) =>
        c.date === sunday &&
        c.location === "lehigh" &&
        c.startMinutes >= 18 * 60 &&
        c.endMinutes <= 22 * 60
    );
    assert.ok(evening.length > 0, "Sun evening Lehi must exist");
    assert.ok(
      evening.some((c) => c.count === 0 && (c.status === "below_minimum" || c.status === "unstaffed_open"))
    );
  });

  it("Thursday Lehi after 4 PM cannot disappear", () => {
    const targets = confirmedTargets();
    const thursday = "2026-09-17";
    const shifts: Shift[] = [
      {
        id: newId("shift"),
        employeeId: "emp_makary",
        date: thursday,
        startMinutes: 12 * 60,
        endMinutes: 16 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "manual",
      },
      {
        id: newId("shift"),
        employeeId: "emp_clausnitzer",
        date: thursday,
        startMinutes: 12 * 60,
        endMinutes: 16 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    const coverage = computeCoverage(shifts, targets, "2026-09-14");
    const after4 = coverage.filter(
      (c) =>
        c.date === thursday &&
        c.location === "lehigh" &&
        c.startMinutes >= 16 * 60 &&
        c.endMinutes <= 22 * 60
    );
    assert.ok(after4.length > 0, "Thu after 4 PM must appear");
    assert.ok(after4.some((c) => c.count === 0 || c.status === "below_minimum"));
  });

  it("Monday noon–5 opener plus 6–10 closer reveals the 5–6 handoff gap", () => {
    const targets = confirmedTargets();
    const monday = "2026-09-14";
    const shifts: Shift[] = [
      {
        id: newId("shift"),
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
        id: newId("shift"),
        employeeId: "emp_noah_miller",
        date: monday,
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ];
    const coverage = computeCoverage(shifts, targets, "2026-09-14");
    const gap = coverage.find(
      (c) =>
        c.date === monday &&
        c.location === "lehigh" &&
        c.startMinutes === 17 * 60 &&
        c.endMinutes === 18 * 60
    );
    assert.ok(gap, "Mon 5–6 handoff gap row must exist under noon–5 / 5–10 model");
    assert.equal(gap!.count, 0);
    assert.ok(gap!.status === "below_minimum" || gap!.status === "unstaffed_open");
  });

  it("Lehi proposals use one daytime opener + evening closer (not dual openers)", () => {
    assert.ok(
      LEHIGH_COVERAGE_PROPOSALS.some(
        (p) =>
          p.days.includes("monday") &&
          p.start === 12 * 60 &&
          p.end === 17 * 60 &&
          p.count === 1
      )
    );
    assert.ok(
      LEHIGH_COVERAGE_PROPOSALS.some(
        (p) =>
          p.days.includes("friday") &&
          p.start === 17 * 60 &&
          p.end === 22 * 60 &&
          p.count === 1
      )
    );
    assert.ok(
      LEHIGH_COVERAGE_PROPOSALS.some(
        (p) => p.days.includes("saturday") && p.start === 13 * 60 && p.end === 18 * 60
      )
    );
    assert.ok(
      LEHIGH_COVERAGE_PROPOSALS.some(
        (p) => p.days.includes("sunday") && p.start === 18 * 60 && p.end === 22 * 60
      )
    );
    // Dual noon–4 openers of count 2 must not remain
    assert.ok(
      !LEHIGH_COVERAGE_PROPOSALS.some(
        (p) => p.start === 12 * 60 && p.end === 16 * 60 && p.count >= 2
      )
    );
  });
});

describe("Dante occasional Lehi + Mike exclusion", () => {
  it("Dante can auto-assign to Lehi; Mike cannot", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const dante = data.employees.find((e) => e.id === "emp_dante_smith")!;
    const mike = data.employees.find((e) => e.id === "emp_mike_wagner")!;
    assert.equal(canAutoAssignToLocation(dante, "lehigh"), true);
    assert.equal(canAutoAssignToLocation(dante, "linden"), true);
    assert.equal(canAutoAssignToLocation(mike, "lehigh"), false);
    assert.equal(canAutoAssignToLocation(mike, "linden"), false);
  });

  it("generation never places Mike; Dante is not required daily on Lehi", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    data.staffingTargets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    const week = ensureWeek(data, "2026-09-14");
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
    assert.equal(
      result.shifts.filter((s) => s.employeeId === "emp_mike_wagner").length,
      0
    );
    const danteLehiDays = new Set(
      result.shifts
        .filter((s) => s.employeeId === "emp_dante_smith" && s.location === "lehigh")
        .map((s) => s.date)
    );
    assert.ok(danteLehiDays.size <= 3, `Dante on Lehi ${danteLehiDays.size} days`);
  });

  it("employee without Lehi evidence remains a conflict even if headcount is met", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const targets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    const monday = "2026-09-14";
    const emily = data.employees.find((e) => e.id === "emp_emily_braido")!;
    emily.dna.lehighEvidenceNotes = [];
    emily.dna.commonShiftTypes = emily.dna.commonShiftTypes.filter(
      (st) => st.location !== "lehigh"
    );
    const shifts: Shift[] = [
      {
        id: newId("shift"),
        employeeId: "emp_emily_braido",
        date: monday,
        startMinutes: 12 * 60,
        endMinutes: 22 * 60,
        location: "lehigh",
        department: "floor",
        locked: false,
        source: "generated",
      },
    ];
    const v = revalidateWeek({
      shifts,
      availability: ensureWeek(data, monday).availability,
      employees: data.employees,
      targets,
      weekStart: monday,
    });
    assert.ok(
      v.issues.some(
        (i) =>
          i.code === "location_eligibility" ||
          i.message?.includes("Lehi eligibility")
      )
    );
  });

  it("Makary and Clausnitzer are Lehi usual identities; McCurry aliases Makary", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    assert.ok(LEHIGH_USUAL_IDS.has("emp_makary"));
    assert.ok(LEHIGH_USUAL_IDS.has("emp_clausnitzer"));
    const makary = data.employees.find((e) => e.id === "emp_makary")!;
    assert.ok(makary.aliases.some((a) => /mccurry|macree/i.test(a.alias)));
  });
});
