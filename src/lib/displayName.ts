import type { Employee } from "./types";

/**
 * Compact schedule/grid display name. Does not invent surnames or change stored identity.
 * Examples: Marques E., Jordan R., Brady Dos., Brady Dol., Kourtney C., F. Makary, B. Clausnitzer.
 */
export function formatCompactEmployeeName(emp: Employee): string {
  if (emp.id === "emp_brady_dosedlo") return "Brady Dos.";
  if (emp.id === "emp_brady_dologite") return "Brady Dol.";
  // Surname unconfirmed — show confirmed initial only (do not invent full surname)
  if (emp.id === "emp_kourtney_cantrel") return "Kourtney C.";

  // Printed first-initial + surname when full first name is unverified
  // (do not invert to "Makary M." / "Clausnitzer C.")
  if (!emp.firstNameConfirmed) {
    const printed = emp.printedLabel?.trim();
    if (printed && /^[A-Z]\.\s*\S+/i.test(printed)) {
      // Normalize "F.Makary" → "F. Makary"
      return printed.replace(/^([A-Za-z])\.\s*/, "$1. ");
    }
    if (emp.id === "emp_makary") return "F. Makary";
    if (emp.id === "emp_clausnitzer") return "B. Clausnitzer";
  }

  if (!emp.lastNameConfirmed && !emp.lastName) {
    return emp.firstName?.trim() || emp.displayName;
  }

  const first = (emp.firstName?.trim() || emp.displayName.split(/\s+/)[0] || emp.displayName).trim();
  if (emp.firstNameConfirmed && emp.lastNameConfirmed && emp.lastName?.trim()) {
    const initial = emp.lastName.trim()[0]!.toUpperCase();
    return `${first} ${initial}.`;
  }

  // Incomplete name — keep confirmed display (Lexi, Brooke, …) or printed label
  if (emp.printedLabel?.trim() && !emp.firstNameConfirmed) {
    return emp.printedLabel.trim().replace(/^([A-Za-z])\.\s*/, "$1. ");
  }
  return emp.displayName;
}

/**
 * Short display names for tight layouts: first name when it is unique on the roster,
 * otherwise the compact name (e.g. "Brady Dol.").
 */
export function buildShortNames(employees: Employee[]): Map<string, string> {
  const compact = new Map(employees.map((employee) => [employee.id, formatCompactEmployeeName(employee)]));
  const firstCount = new Map<string, number>();
  for (const name of compact.values()) {
    const first = name.split(/\s+/)[0] ?? name;
    firstCount.set(first, (firstCount.get(first) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const [id, name] of compact) {
    const first = name.split(/\s+/)[0] ?? name;
    out.set(id, firstCount.get(first) === 1 ? first : name);
  }
  return out;
}
