import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSeedEmployees } from "../src/lib/seed/employees";
import { applyManagerDnaCorrections } from "../src/lib/dnaCorrections";
import {
  resolveEmployeeName,
  formatOcrReviewHeadline,
  suggestActiveRosterCandidates,
} from "../src/lib/names";
import { formatCompactEmployeeName } from "../src/lib/displayName";

const employees = buildSeedEmployees();
applyManagerDnaCorrections(employees);

describe("active-roster OCR identity matching", () => {
  it("suggests Jordan R. for Jorhan / Johan without creating aliases", () => {
    for (const q of ["Jorhan", "Johan", "john"]) {
      const r = resolveEmployeeName(q, employees);
      assert.equal(r.status, "ambiguous");
      assert.deepEqual(r.employeeIds, ["emp_josh_roman"]);
      assert.equal(r.reviewHeadline, "Possible match: Jordan R.");
      assert.ok(!employees.find((e) => e.id === "emp_josh_roman")!.aliases.some((a) => a.alias === q));
    }
  });

  it("suggests Naliyah for maliyah / Malia without permanent OCR alias", () => {
    for (const q of ["maliyah", "Malia"]) {
      const r = resolveEmployeeName(q, employees);
      assert.equal(r.status, "ambiguous");
      assert.ok(r.employeeIds.includes("emp_naliyah_bennick"));
      assert.match(r.reviewHeadline ?? "", /Naliyah/);
      assert.ok(
        !employees
          .find((e) => e.id === "emp_naliyah_bennick")!
          .aliases.some((a) => a.alias.toLowerCase() === "maliyah")
      );
    }
  });

  it("Andrew suggests Addison G. and Alex C.; Andrew is never a candidate", () => {
    const r = resolveEmployeeName("Andrew", employees);
    assert.equal(r.status, "ambiguous");
    assert.ok(r.employeeIds.includes("emp_addy_giesler"));
    assert.ok(r.employeeIds.includes("emp_alex_cheatham"));
    assert.ok(!r.employeeIds.some((id) => /andrew/i.test(id)));
    assert.ok(!employees.some((e) => e.status === "active" && /^andrew$/i.test(e.firstName ?? "")));
    assert.match(r.reviewHeadline ?? "", /Addison/);
    assert.match(r.reviewHeadline ?? "", /Alex/);
    // Inactive Andrew must not appear in suggest list
    const ids = suggestActiveRosterCandidates("Andrew", [
      ...employees,
      {
        ...employees[0]!,
        id: "emp_andrew_quit",
        firstName: "Andrew",
        displayName: "Andrew",
        status: "inactive",
      },
    ]);
    assert.ok(!ids.includes("emp_andrew_quit"));
  });

  it("does not force exact match for lookalikes", () => {
    assert.notEqual(resolveEmployeeName("Jorhan", employees).status, "exact");
    assert.notEqual(resolveEmployeeName("maliyah", employees).status, "exact");
    assert.notEqual(resolveEmployeeName("Andrew", employees).status, "exact");
  });

  it("keeps Brady ambiguous and exact Brady Dosedlo exact", () => {
    assert.equal(resolveEmployeeName("Brady", employees).status, "ambiguous");
    assert.equal(resolveEmployeeName("Brady Dosedlo", employees).status, "exact");
  });

  it("returns Unrecognized mark when no active candidate is supported", () => {
    const r = resolveEmployeeName("Xyzzyq", employees);
    assert.equal(r.status, "unknown");
    assert.equal(r.employeeIds.length, 0);
    assert.equal(r.reviewHeadline, "Unrecognized mark");
  });

  it("does not suggest wrong-initial legacy A. Miller as Noah", () => {
    const r = resolveEmployeeName("A. Miller", employees);
    assert.equal(r.status, "unknown");
    assert.equal(r.employeeIds.length, 0);
  });

  it("formats multi-candidate headlines", () => {
    const h = formatOcrReviewHeadline(employees, [
      "emp_addy_giesler",
      "emp_alex_cheatham",
    ]);
    assert.equal(
      h,
      `Could be ${formatCompactEmployeeName(employees.find((e) => e.id === "emp_addy_giesler")!)} or ${formatCompactEmployeeName(employees.find((e) => e.id === "emp_alex_cheatham")!)}`
    );
  });

  it("never includes inactive employees among candidates", () => {
    const withInactive = employees.map((e) =>
      e.id === "emp_josh_roman" ? { ...e, status: "inactive" as const } : e
    );
    const r = resolveEmployeeName("Jorhan", withInactive);
    assert.ok(!r.employeeIds.includes("emp_josh_roman"));
  });

  it("bare Mia is never an exact roster hit (false-positive guard)", () => {
    const r = resolveEmployeeName("Mia", employees);
    assert.notEqual(r.status, "exact");
    assert.ok(r.status === "ambiguous" || r.status === "unknown");
  });

  it("F. Makary and B. Clausnitzer resolve to existing IDs", () => {
    assert.equal(resolveEmployeeName("F. Makary", employees).status, "exact");
    assert.equal(resolveEmployeeName("F. Makary", employees).employeeIds[0], "emp_makary");
    assert.equal(resolveEmployeeName("B. Clausnitzer", employees).status, "exact");
    assert.equal(
      resolveEmployeeName("B. Clausnitzer", employees).employeeIds[0],
      "emp_clausnitzer"
    );
    assert.equal(formatCompactEmployeeName(employees.find((e) => e.id === "emp_makary")!), "F. Makary");
    assert.equal(
      formatCompactEmployeeName(employees.find((e) => e.id === "emp_clausnitzer")!),
      "B. Clausnitzer"
    );
  });
});
