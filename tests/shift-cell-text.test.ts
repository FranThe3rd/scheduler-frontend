import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatShiftCellCompact,
  formatShiftCellText,
  parseShiftCellText,
  shiftToCellText,
} from "../src/lib/shiftCellText";

describe("shift cell text", () => {
  it("formats store-style hours", () => {
    assert.equal(formatShiftCellCompact(9 * 60, 13 * 60), "9–1");
    assert.equal(formatShiftCellCompact(12 * 60, 18 * 60), "12–6");
    assert.equal(formatShiftCellCompact(18 * 60, 22 * 60), "6–10");
  });

  it("parses and round-trips compact ranges", () => {
    const t = parseShiftCellText("9-1");
    assert.ok(t);
    assert.equal(
      formatShiftCellCompact(t!.startMinutes!, t!.endMinutes!),
      "9–1"
    );
  });

  it("treats blank as off", () => {
    assert.equal(parseShiftCellText(""), null);
    assert.equal(parseShiftCellText("—"), null);
  });

  it("parses IC-only cells", () => {
    const ic = parseShiftCellText("IC");
    assert.ok(ic);
    assert.equal(formatShiftCellText(ic!), "IC");
  });

  it("parses Lehigh L and IC suffixes", () => {
    const lehigh = parseShiftCellText("12-6 L");
    assert.ok(lehigh);
    assert.equal(lehigh!.location, "lehigh");
    assert.equal(lehigh!.department, "floor");

    const ic = parseShiftCellText("9-1 IC");
    assert.ok(ic);
    assert.equal(ic!.location, "linden");
    assert.equal(ic!.department, "ic");

    const both = parseShiftCellText("6-10 L IC");
    assert.ok(both);
    assert.equal(formatShiftCellText(both!), "6–10 L IC");
  });

  it("renders IC-only cells", () => {
    assert.equal(
      shiftToCellText({
        id: "s0",
        employeeId: "e1",
        date: "2026-10-05",
        startMinutes: null,
        endMinutes: null,
        location: "linden",
        department: "ic",
        locked: false,
        source: "manual",
        notes: "IC",
      }),
      "IC"
    );
  });

  it("renders IC on timed shift cells", () => {
    assert.equal(
      shiftToCellText({
        id: "s1",
        employeeId: "e1",
        date: "2026-10-05",
        startMinutes: 12 * 60,
        endMinutes: 18 * 60,
        location: "linden",
        department: "ic",
        locked: false,
        source: "manual",
      }),
      "12–6 IC"
    );
  });
});
