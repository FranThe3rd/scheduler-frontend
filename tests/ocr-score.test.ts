import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreCalendarMarks } from "../src/lib/ocrScore";

describe("full calendar OCR score", () => {
  it("counts false-positive Mia as an error", () => {
    const expected = [
      { employeeId: "emp_addy_giesler", date: "2026-09-19" },
      { employeeId: "emp_alexis_horvath", date: "2026-09-20" },
    ];
    const extracted = [
      { employeeId: "emp_addy_giesler", date: "2026-09-19" },
      { employeeId: "emp_alexis_horvath", date: "2026-09-20" },
      { employeeId: "emp_invented_mia", date: "2026-09-15", rawName: "Mia" },
    ];
    const s = scoreCalendarMarks({ expected, extracted });
    assert.equal(s.correct.length, 2);
    assert.equal(s.extra.length, 1);
    assert.equal(s.extra[0]!.rawName, "Mia");
    assert.ok(s.precisionRecall.falsePositive >= 1);
    assert.ok(s.precisionRecall.score < 1);
  });

  it("flags Addison Friday mark landing on Thursday as wrong date", () => {
    const expected = [{ employeeId: "emp_addy_giesler", date: "2026-09-19" }];
    const extracted = [
      { employeeId: "emp_addy_giesler", date: "2026-09-18", rawName: "Addison" },
    ];
    const s = scoreCalendarMarks({ expected, extracted });
    assert.equal(s.correct.length, 0);
    assert.equal(s.wrongDate.length, 1);
    assert.equal(s.wrongDate[0]!.expectedDate, "2026-09-19");
    assert.equal(s.wrongDate[0]!.gotDate, "2026-09-18");
    assert.ok(s.precisionRecall.score < 1);
  });

  it("15/15 with one extra is not a perfect score", () => {
    const expected = Array.from({ length: 15 }, (_, i) => ({
      employeeId: `emp_${i}`,
      date: "2026-09-14",
    }));
    const extracted = [
      ...expected,
      { employeeId: "emp_extra", date: "2026-09-16", rawName: "Addison" },
    ];
    const s = scoreCalendarMarks({ expected, extracted });
    assert.equal(s.correct.length, 15);
    assert.equal(s.extra.length, 1);
    assert.ok(s.precisionRecall.score < 1);
  });
});
