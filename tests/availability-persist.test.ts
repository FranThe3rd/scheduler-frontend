import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmployee } from "../src/lib/createEmployee";
import { handleMockRequest } from "../src/lib/mock/handlers";
import {
  applyManualAvailability,
  extractManualAvailability,
  getMockAppData,
  resetMockStore,
  setMockRoster,
} from "../src/lib/mock/store";

describe("availability persistence helpers", () => {
  it("round-trips manually entered availability through a fresh store", () => {
    resetMockStore();
    const employee = { ...createEmployee({ displayName: "Test Person", colorIndex: 0 }), id: "uid_1" };
    setMockRoster([employee]);

    const res = handleMockRequest(
      "/api/availability",
      "PUT",
      JSON.stringify({
        weekStart: "2026-10-26",
        employeeId: "uid_1",
        date: "2026-10-28",
        cell: { kind: "off", note: "Off" },
      }),
      new URLSearchParams()
    );
    assert.equal(res.status, 200);

    const saved = extractManualAvailability("uid_1");
    assert.deepEqual(Object.keys(saved), ["2026-10-28"]);

    // Simulate a fresh page load reading it back from saved state.
    resetMockStore();
    setMockRoster([employee]);
    applyManualAvailability("uid_1", saved);
    const week = getMockAppData().weeks.find((w) => w.weekStart === "2026-10-26")!;
    const cell = week.availability.find((a) => a.employeeId === "uid_1")!.cells["2026-10-28"]!;
    assert.equal(cell.kind, "off");
    assert.equal(cell.source, "manual");
  });
});
