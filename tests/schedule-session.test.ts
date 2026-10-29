import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyAppData, ensureWeek } from "../src/lib/fixtures/appData";
import { applyManagerDnaCorrections } from "../src/lib/dnaCorrections";
import { applySep14ManagerCorrections, SEP14_TEST_WEEK } from "../src/lib/managerWeekCorrections";
import {
  buildFreshWorkingWeek,
  parkWorkingWeeksAsSaved,
  startFreshCreationSession,
  restoreSavedSession,
  listPreviousSchedules,
  weekHasMeaningfulWork,
  rememberWorkingWeekInPrevious,
} from "../src/lib/scheduleSession";
import {
  confirmLehighTargetsOnly,
  confirmLindenTargetsOnly,
  buildDefaultStaffingTargets,
} from "../src/lib/staffingTargets";

describe("creation session vs saved drafts", () => {
  it("parks meaningful working weeks into Previous schedules on refresh shell", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const week = ensureWeek(data, "2026-09-28");
    week.shifts = [
      {
        id: "s1",
        employeeId: "emp_dante_smith",
        date: "2026-09-28",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "linden",
        department: "floor",
        locked: false,
        source: "generated",
      },
    ];
    week.availabilityReviewed = true;
    week.photoStorageKey = "upload_test.jpg";

    assert.equal(weekHasMeaningfulWork(week), true);
    parkWorkingWeeksAsSaved(data);
    assert.equal(data.weeks.some((w) => w.weekStart === "2026-09-28"), false);
    const prev = listPreviousSchedules(data);
    assert.ok(prev.some((p) => p.weekStart === "2026-09-28" && p.shiftCount === 1 && p.hasPhoto));
  });

  it("startFresh creates blank week without Sep14 fixture offs", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    ensureWeek(data, SEP14_TEST_WEEK);
    applySep14ManagerCorrections(data);
    const jordanBefore = data.weeks
      .find((w) => w.weekStart === SEP14_TEST_WEEK)!
      .availability.find((a) => a.employeeId === "emp_josh_roman")!;
    assert.equal(jordanBefore.cells["2026-09-14"]?.kind, "off");

    // Park fixture work, then start fresh
    parkWorkingWeeksAsSaved(data);
    const { week } = startFreshCreationSession(data, SEP14_TEST_WEEK);
    assert.equal(week.shifts.length, 0);
    assert.equal(week.availabilityReviewed, false);
    assert.equal(week.photoStorageKey, null);
    assert.deepEqual(week.dismissedExtractionKeys, []);
    const jordan = week.availability.find((a) => a.employeeId === "emp_josh_roman")!;
    // Recurring may apply windows — but not the fixture manual Sep14 offs
    assert.notEqual(jordan.cells["2026-09-14"]?.source, "manual");
    assert.ok(listPreviousSchedules(data).some((p) => p.weekStart === SEP14_TEST_WEEK));
  });

  it("restore returns archived photo, offs, and shifts", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    const week = ensureWeek(data, "2026-10-05");
    week.photoStorageKey = "upload_restore.jpg";
    week.availabilityReviewed = true;
    week.shifts = [
      {
        id: "s2",
        employeeId: "emp_marietta_zweifel",
        date: "2026-10-05",
        startMinutes: 9 * 60,
        endMinutes: 13 * 60,
        location: "linden",
        department: "floor",
        locked: true,
        source: "manual",
      },
    ];
    const addy = week.availability.find((a) => a.employeeId === "emp_addy_giesler")!;
    addy.cells["2026-10-05"] = { kind: "off", note: "Off", source: "photo" };

    parkWorkingWeeksAsSaved(data);
    const sessions = listPreviousSchedules(data);
    const id = sessions.find((s) => s.weekStart === "2026-10-05")!.id;

    // Fresh session in between
    startFreshCreationSession(data, "2026-10-05");
    assert.equal(
      data.weeks.find((w) => w.weekStart === "2026-10-05")!.shifts.length,
      0
    );

    const restored = restoreSavedSession(data, id);
    assert.ok(restored);
    assert.equal(restored!.photoStorageKey, "upload_restore.jpg");
    assert.equal(restored!.week.shifts.length, 1);
    assert.equal(
      restored!.week.availability.find((a) => a.employeeId === "emp_addy_giesler")!.cells[
        "2026-10-05"
      ]?.kind,
      "off"
    );
  });

  it("fresh week keeps staffing targets and employee DNA intact", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    data.staffingTargets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    const beforeTargets = data.staffingTargets.length;
    const beforeEmp = data.employees.length;
    startFreshCreationSession(data, "2026-10-12");
    assert.equal(data.staffingTargets.length, beforeTargets);
    assert.equal(data.employees.length, beforeEmp);
    assert.equal(data.employees.find((e) => e.id === "emp_mike_wagner")?.autoScheduleEnabled, false);
  });

  it("rememberWorkingWeekInPrevious snapshots after generate without wiping staffing", () => {
    const data = createEmptyAppData();
    applyManagerDnaCorrections(data.employees);
    data.staffingTargets = confirmLehighTargetsOnly(
      confirmLindenTargetsOnly(buildDefaultStaffingTargets())
    );
    const week = buildFreshWorkingWeek(data, "2026-10-19");
    data.weeks = [week];
    week.shifts = [
      {
        id: "s3",
        employeeId: "emp_dante_smith",
        date: "2026-10-19",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "linden",
        department: "floor",
        locked: false,
        source: "generated",
      },
    ];
    rememberWorkingWeekInPrevious(data, week.weekStart);
    assert.ok(listPreviousSchedules(data).some((p) => p.weekStart === "2026-10-19"));
    assert.ok(data.staffingTargets.some((t) => t.location === "lehigh" && t.confirmed));
  });
});
