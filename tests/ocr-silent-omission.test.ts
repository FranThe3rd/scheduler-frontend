import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreCalendarMarks } from "../src/lib/ocrScore";

describe("silent omission is scored as a miss", () => {
  const expected = [
    { employeeId: "emp_addy_giesler", date: "2026-09-14" },
    { employeeId: "emp_addy_giesler", date: "2026-09-16" },
    { employeeId: "emp_addy_giesler", date: "2026-09-18" },
    { employeeId: "emp_addy_giesler", date: "2026-09-20" },
    { employeeId: "emp_josh_roman", date: "2026-09-14" },
    { employeeId: "emp_josh_roman", date: "2026-09-15" },
    { employeeId: "emp_josh_roman", date: "2026-09-16" },
    { employeeId: "emp_josh_roman", date: "2026-09-17" },
    { employeeId: "emp_josh_roman", date: "2026-09-18" },
    { employeeId: "emp_josh_roman", date: "2026-09-19" },
    { employeeId: "emp_josh_roman", date: "2026-09-20" },
    { employeeId: "emp_alexis_horvath", date: "2026-09-19" },
    { employeeId: "emp_alexis_horvath", date: "2026-09-20" },
    { employeeId: "emp_calvin_rittle", date: "2026-09-19" },
    { employeeId: "emp_calvin_rittle", date: "2026-09-20" },
  ];

  it("counts blank Addison row (all four missing) as four misses, not a pass", () => {
    const extracted = expected
      .filter((e) => e.employeeId !== "emp_addy_giesler")
      .map((e) => ({ ...e }));
    const s = scoreCalendarMarks({ expected, extracted });
    assert.equal(s.missing.length, 4);
    assert.ok(s.missing.every((m) => m.employeeId === "emp_addy_giesler"));
    assert.ok(s.precisionRecall.score < 1);
  });

  it("counts Saturday skip (Alexis+Calvin missing) as misses", () => {
    const extracted = expected.filter((e) => e.date !== "2026-09-19");
    const s = scoreCalendarMarks({ expected, extracted });
    assert.ok(s.missing.some((m) => m.employeeId === "emp_alexis_horvath"));
    assert.ok(s.missing.some((m) => m.employeeId === "emp_calvin_rittle"));
    assert.ok(s.missing.some((m) => m.employeeId === "emp_josh_roman"));
  });
});
