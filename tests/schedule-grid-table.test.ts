import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildScheduleTableMatrix, buildScheduleGridRows } from "../src/lib/scheduleGridTable";
import { createEmptyAppData } from "../src/lib/fixtures/appData";
import { ensureWeek } from "../src/lib/fixtures/appData";
import { buildOct2025DemoWeek } from "../src/lib/mock/oct2025Schedule";
import { createEmployee } from "../src/lib/createEmployee";

describe("schedule grid table export", () => {
  it("builds employee rows and a 8-column table", () => {
    const data = createEmptyAppData();
    buildOct2025DemoWeek(data);
    const week = ensureWeek(data, "2026-10-05");
    const rows = buildScheduleGridRows(data.employees);
    assert.ok(rows.length > 5);
    const { headers, body } = buildScheduleTableMatrix(week, data.employees);
    assert.equal(headers.length, 8);
    assert.equal(headers[0], "Employee");
    assert.equal(
      body.length,
      buildScheduleGridRows(data.employees, week.shifts).length
    );
    assert.equal(body[0]!.length, 8);
  });

  it("appends active employees not on the paper roster", () => {
    const data = createEmptyAppData();
    buildOct2025DemoWeek(data);
    const extra = createEmployee({
      displayName: "New Hire",
      printedLabel: "N. Hire",
      colorIndex: 99,
    });
    data.employees.push(extra);
    const rows = buildScheduleGridRows(data.employees);
    assert.equal(rows[0]!.employeeId, extra.id);
    assert.equal(rows[0]!.label, "N. Hire");
  });

  it("shows Lexi and Brooke separately and only shows the historical shared row when scheduled", () => {
    const data = createEmptyAppData();
    const week = buildOct2025DemoWeek(data);
    const rows = buildScheduleGridRows(data.employees);
    const currentRows = rows.filter(
      (r) => r.label === "Lexy/Brooke" || r.employeeId === "emp_lexi" || r.employeeId === "emp_brooke"
    );
    assert.deepEqual(
      currentRows.map((row) => row.employeeId).sort(),
      ["emp_brooke", "emp_lexi"]
    );
    assert.ok(currentRows.every((row) => row.label !== "Lexy/Brooke"));

    const historicalRows = buildScheduleGridRows(data.employees, week.shifts);
    assert.ok(
      historicalRows.some((row) => row.employeeId === null && row.label === "Lexy/Brooke")
    );
  });
});
