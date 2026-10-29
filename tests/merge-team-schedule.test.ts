import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeTeamSchedule } from "../src/lib/mergeTeamSchedule";
import { createEmployee } from "../src/lib/createEmployee";
import type { WeekSchedule } from "../src/lib/types";

function emptyWeek(weekStart: string): WeekSchedule {
  return {
    id: `week_${weekStart}`,
    weekStart,
    weekEnd: "2026-10-25",
    status: "draft",
    shifts: [],
    availability: [],
    availabilityReviewed: false,
    issues: [],
    coverage: [],
    totals: [],
    explanation: {
      bullets: [],
      allAvailabilityHonored: false,
      provisionalCount: 0,
      unresolvedAvailabilityCount: 0,
      unresolvedLocationCount: 0,
      availabilityCalendarEntered: false,
      provisionalDraft: false,
    },
  };
}

describe("mergeTeamSchedule", () => {
  it("lets canonical week shifts win over published and approved requests", () => {
    const employee = createEmployee({ displayName: "Fran", printedLabel: "Fran", colorIndex: 0 });
    employee.id = "emp_fran";
    const week = emptyWeek("2026-10-19");
    week.shifts = [
      {
        id: "canonical",
        employeeId: employee.id,
        date: "2026-10-19",
        startMinutes: 9 * 60,
        endMinutes: 13 * 60,
        location: "linden",
        department: "floor",
        locked: true,
        source: "manual",
      },
    ];
    const merged = mergeTeamSchedule({
      week,
      employees: [employee],
      published: {
        weekStart: week.weekStart,
        assignments: [
          {
            employeeId: employee.id,
            employeeName: "Fran",
            shifts: [
              {
                date: "2026-10-19",
                startMinutes: 11 * 60,
                endMinutes: 15 * 60,
                location: "lehigh",
                department: "floor",
              },
            ],
          },
        ],
      },
      approvedRequests: [
        {
          id: "req",
          uid: employee.id,
          name: "Fran",
          weekStart: week.weekStart,
          days: {},
          status: "approved",
          createdAt: "",
          assignedShifts: [
            {
              date: "2026-10-19",
              startMinutes: 7 * 60,
              endMinutes: 11 * 60,
              location: "linden",
              department: "floor",
            },
          ],
        },
      ],
    });
    assert.equal(merged.shifts.length, 1);
    assert.equal(merged.shifts[0]!.id, "canonical");
  });

  it("fills from published then approved requests when the week is empty", () => {
    const week = emptyWeek("2026-10-19");
    const merged = mergeTeamSchedule({
      week,
      employees: [],
      published: {
        weekStart: week.weekStart,
        assignments: [
          {
            employeeId: "emp_bob",
            employeeName: "Bob Ross",
            shifts: [
              {
                date: "2026-10-18",
                startMinutes: 9 * 60,
                endMinutes: 13 * 60,
                location: "linden",
                department: "floor",
              },
            ],
          },
        ],
      },
      approvedRequests: [
        {
          id: "req_fran",
          uid: "emp_fran",
          name: "Fran",
          weekStart: week.weekStart,
          days: {},
          status: "approved",
          createdAt: "",
          assignedShifts: [
            {
              date: "2026-10-19",
              startMinutes: 9 * 60,
              endMinutes: 13 * 60,
              location: "linden",
              department: "floor",
            },
          ],
        },
      ],
    });
    assert.equal(merged.shifts.length, 2);
    assert.ok(merged.employees.some((employee) => employee.id === "emp_bob"));
    assert.ok(merged.employees.some((employee) => employee.id === "emp_fran"));
    assert.equal(merged.week.status, "approved");
  });
});
