import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { weekClipboardFromShifts } from "../src/lib/scheduleClipboard";

describe("schedule clipboard", () => {
  it("builds week templates with day index", () => {
    const clip = weekClipboardFromShifts("2026-10-05", [
      {
        id: "s1",
        employeeId: "emp_a",
        date: "2026-10-07",
        startMinutes: 18 * 60,
        endMinutes: 22 * 60,
        location: "linden",
        department: "floor",
        locked: false,
        source: "manual",
      },
    ]);
    assert.equal(clip.kind, "week");
    assert.equal(clip.items[0]!.dayIndex, 2);
  });
});
