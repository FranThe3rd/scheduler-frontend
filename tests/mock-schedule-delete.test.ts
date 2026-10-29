import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleMockRequest } from "../src/lib/mock/handlers";
import { DEMO_WEEK_START } from "../src/lib/mock/oct2025Schedule";
import { getMockAppData } from "../src/lib/mock/store";
import { buildSeedEmployees } from "../src/lib/seed/employees";

function post(path: string, body: Record<string, unknown>) {
  return handleMockRequest(path, "PUT", JSON.stringify(body), new URLSearchParams());
}

function bootstrap(week: string, resetDemo = false) {
  const params = new URLSearchParams({ week, mode: "shell" });
  if (resetDemo) params.set("resetDemo", "1");
  return handleMockRequest("/api/bootstrap", "GET", null, params);
}

describe("mock schedule delete", () => {
  // The live store starts with an empty roster; the demo week needs the seeded one.
  getMockAppData().employees = buildSeedEmployees();

  it("removes a shift in session and bootstrap does not restore it", () => {
    getMockAppData();
    bootstrap(DEMO_WEEK_START, true);
    const data = getMockAppData();
    const week = data.weeks.find((w) => w.weekStart === DEMO_WEEK_START)!;
    const target = week.shifts.find((s) => s.employeeId === "emp_jenn_stone")!;
    assert.ok(target);

    const del = post("/api/schedule", {
      weekStart: DEMO_WEEK_START,
      action: "delete",
      shiftId: target.id,
    });
    assert.equal(del.status, 200);

    const after = getMockAppData().weeks.find((w) => w.weekStart === DEMO_WEEK_START)!;
    assert.ok(!after.shifts.some((s) => s.id === target.id));

    const boot = bootstrap(DEMO_WEEK_START, false);
    assert.equal(boot.status, 200);
    const bootWeek = (boot as { json: { week: { shifts: typeof after.shifts } } }).json.week;
    assert.ok(!bootWeek.shifts.some((s) => s.id === target.id));
  });

  it("resetDemo=1 restores seeded demo shifts", () => {
    getMockAppData();
    bootstrap(DEMO_WEEK_START, true);
    const week = getMockAppData().weeks.find((w) => w.weekStart === DEMO_WEEK_START)!;
    const beforeCount = week.shifts.length;
    const target = week.shifts[0]!;
    post("/api/schedule", {
      weekStart: DEMO_WEEK_START,
      action: "delete",
      shiftId: target.id,
    });
    assert.equal(
      getMockAppData().weeks.find((w) => w.weekStart === DEMO_WEEK_START)!.shifts.length,
      beforeCount - 1
    );

    bootstrap(DEMO_WEEK_START, true);
    assert.equal(
      getMockAppData().weeks.find((w) => w.weekStart === DEMO_WEEK_START)!.shifts.length,
      beforeCount
    );
  });
});
