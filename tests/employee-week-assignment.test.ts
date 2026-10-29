import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleMockRequest } from "../src/lib/mock/handlers";
import { getMockAppData, resetMockStore } from "../src/lib/mock/store";
import { buildSeedEmployees } from "../src/lib/seed/employees";

describe("employee weekly schedule assignment", () => {
  it("assigns all selected days in one action and replaces them without duplicates", () => {
    resetMockStore();
    const data = getMockAppData();
    const employee = buildSeedEmployees()[0]!;
    data.employees = [employee];
    const weekStart = "2026-10-12";
    const shifts = [
      {
        date: "2026-10-12",
        startMinutes: 9 * 60,
        endMinutes: 13 * 60,
        location: "linden",
        department: "floor",
      },
      {
        date: "2026-10-14",
        startMinutes: 13 * 60,
        endMinutes: 18 * 60,
        location: "lehigh",
        department: "ic",
      },
    ];

    const assign = () =>
      handleMockRequest(
        "/api/schedule",
        "PUT",
        JSON.stringify({
          weekStart,
          action: "assign_employee_week",
          employeeId: employee.id,
          shifts,
        }),
        new URLSearchParams()
      );

    assert.equal(assign().status, 200);
    assert.equal(assign().status, 200);

    const week = data.weeks.find((item) => item.weekStart === weekStart)!;
    const assigned = week.shifts.filter((shift) => shift.employeeId === employee.id);
    assert.equal(assigned.length, 2);
    assert.deepEqual(
      assigned.map((shift) => shift.date),
      ["2026-10-12", "2026-10-14"]
    );
    assert.ok(assigned.every((shift) => shift.locked && shift.source === "manual"));
  });
});
