import type { Employee, NameMatchResult } from "./types";
import { formatCompactEmployeeName } from "./displayName";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectTokens(employee: Employee): string[] {
  const tokens = new Set<string>();
  tokens.add(normalize(employee.displayName));
  tokens.add(normalize(employee.printedLabel));
  if (employee.firstName) tokens.add(normalize(employee.firstName));
  if (employee.lastName) tokens.add(normalize(employee.lastName));
  for (const a of employee.aliases) {
    tokens.add(normalize(a.alias));
  }
  if (employee.firstName && employee.lastName) {
    tokens.add(normalize(`${employee.firstName[0]} ${employee.lastName}`));
  }
  return [...tokens];
}

function activePool(
  employees: Employee[],
  opts?: { includeInactive?: boolean }
): Employee[] {
  return employees.filter((e) => opts?.includeInactive || e.status === "active");
}

/** Levenshtein edit distance (small strings only). */
export function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array(t.length + 1);
  const cur = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= t.length; j++) prev[j] = cur[j];
  }
  return prev[t.length]!;
}

/**
 * Dialog lead for uncertain OCR marks.
 * "Possible match: Jordan R." / "Could be Addison G. or Alex C." / "Unrecognized mark"
 */
export function formatOcrReviewHeadline(
  employees: Employee[],
  candidateIds: string[]
): string {
  const labels = candidateIds
    .map((id) => employees.find((e) => e.id === id && e.status === "active"))
    .filter((e): e is Employee => Boolean(e))
    .map((e) => formatCompactEmployeeName(e));
  if (labels.length === 0) return "Unrecognized mark";
  if (labels.length === 1) return `Possible match: ${labels[0]}`;
  if (labels.length === 2) return `Could be ${labels[0]} or ${labels[1]}`;
  const last = labels[labels.length - 1]!;
  return `Could be ${labels.slice(0, -1).join(", ")}, or ${last}`;
}

type Scored = { id: string; score: number };

/**
 * Score how well an OCR reading resembles an active employee.
 * Uses spelling similarity, approved nicknames, and first/last-initial forms.
 * Does NOT use usual workdays or create permanent aliases.
 */
function scoreEmployeeAgainstQuery(q: string, emp: Employee): number {
  if (emp.status !== "active") return 0;
  const tokens = collectTokens(emp);
  if (tokens.includes(q)) return 100;

  const qParts = q.split(" ").filter(Boolean);
  const qFirst = qParts[0] ?? q;
  const first = emp.firstName ? normalize(emp.firstName) : "";
  const last = emp.lastName ? normalize(emp.lastName) : "";
  const displayFirst = normalize(emp.displayName).split(" ")[0] ?? "";
  const firsts = [...new Set([first, displayFirst].filter(Boolean))];

  let best = 0;

  for (const f of firsts) {
    const d = editDistance(qFirst, f);
    if (d === 0) best = Math.max(best, 95);
    else if (d === 1 && Math.min(qFirst.length, f.length) >= 4) best = Math.max(best, 82);
    else if (d === 1 && Math.min(qFirst.length, f.length) >= 3) best = Math.max(best, 74);
    else if (d === 2 && Math.min(qFirst.length, f.length) >= 5) best = Math.max(best, 62);
    else if (d === 2 && Math.min(qFirst.length, f.length) >= 4) best = Math.max(best, 55);

    // Shared long prefix (jorhan / jordan)
    let pref = 0;
    const lim = Math.min(qFirst.length, f.length);
    while (pref < lim && qFirst[pref] === f[pref]) pref++;
    if (pref >= 4 && Math.abs(qFirst.length - f.length) <= 2) {
      best = Math.max(best, 50 + pref * 4);
    }
  }

  // Confirmed / stored aliases (already on employee — not invented from this OCR)
  for (const a of emp.aliases) {
    const al = normalize(a.alias);
    const d = editDistance(q, al);
    const sameTokenCount =
      q.split(" ").filter(Boolean).length === al.split(" ").filter(Boolean).length;
    const lenClose = Math.abs(q.length - al.length) <= 1;
    if (d === 0) best = Math.max(best, a.confirmed ? 98 : 90);
    // Require similar shape so "a miller" does not soft-match last-name alias "Miller"
    else if (d === 1 && al.length >= 4 && sameTokenCount && lenClose) {
      best = Math.max(best, a.confirmed ? 80 : 70);
    } else if (d === 2 && al.length >= 5 && sameTokenCount && lenClose) {
      best = Math.max(best, 58);
    }
    const alFirst = al.split(" ")[0]!;
    const da = editDistance(qFirst, alFirst);
    if (
      da === 1 &&
      alFirst.length >= 4 &&
      Math.abs(qFirst.length - alFirst.length) <= 2 &&
      qParts.length === 1
    ) {
      best = Math.max(best, 76);
    }
  }

  // Printed / display full-string near-miss (same token count only)
  for (const label of [normalize(emp.displayName), normalize(emp.printedLabel)]) {
    if (!label) continue;
    const lParts = label.split(" ").filter(Boolean);
    const sameTokenCount = qParts.length === lParts.length;
    if (!sameTokenCount) continue;
    // Initial + surname forms: "a miller" must not soft-match "n miller"
    if (
      qParts.length === 2 &&
      qParts[0]!.length === 1 &&
      lParts[0]!.length === 1 &&
      qParts[0] !== lParts[0]
    ) {
      continue;
    }
    const d = editDistance(q, label);
    if (d === 1 && label.length >= 5) best = Math.max(best, 75);
  }

  // First-name + last-initial: "jordan r", "b dologite"
  if (qParts.length >= 2 && first) {
    const qLast = qParts[qParts.length - 1]!;
    if (editDistance(qFirst, first) <= 1) {
      if (last && (qLast === last[0] || qLast === last || editDistance(qLast, last) <= 2)) {
        best = Math.max(best, 88);
      }
      if (qLast.length === 1 && last && qLast === last[0]) best = Math.max(best, 90);
    }
  }

  // Initial + surname ("n miller") — only when the initial matches this person
  if (qParts.length === 2 && qParts[0]!.length === 1 && last) {
    const initial = qParts[0]!;
    const qLast = qParts[1]!;
    if (editDistance(qLast, last) <= 1 && first && initial === first[0]) {
      best = Math.max(best, 92);
    }
  }

  // Last name alone already handled as exact elsewhere; soft last-name distance
  if (last && qParts.length === 1) {
    const d = editDistance(q, last);
    if (d === 1 && last.length >= 5) best = Math.max(best, 70);
  }

  return best;
}

/**
 * Known OCR confusions that are NOT permanent aliases — per-mark suggestions only.
 * Inactive names never appear as candidates.
 */
function specialOcrSuggestions(q: string, pool: Employee[]): Scored[] {
  const out: Scored[] = [];
  const find = (id: string, score: number) => {
    if (pool.some((e) => e.id === id)) out.push({ id, score });
  };

  // Jordan misreads (John / Johan / Jorhan / Jordon …)
  if (/^(john|johan|jorhan|jordon|jordn|joran)$/.test(q)) {
    find("emp_josh_roman", 85);
  }

  // Naliyah misreads (Malia / Maliyah — N↔M handwriting)
  // Do NOT treat bare "Mia" as an exact/auto identity — too short / not on roster.
  if (/^(malia|maliyah|nalia|naliayh|naliaya)$/.test(q)) {
    find("emp_naliyah_bennick", 84);
  }

  // Andrew is inactive — suggest active A-names the handwriting may actually be
  if (q === "andrew" || q.startsWith("andrew ")) {
    find("emp_addy_giesler", 78); // Addison
    find("emp_alex_cheatham", 72); // Alex C.
  }

  // Bare "Mia" is not a roster identity — force review (never invent Mia employee)
  if (q === "mia") {
    find("emp_naliyah_bennick", 60);
    find("emp_marietta_zweifel", 55);
  }

  return out;
}

const SUGGEST_THRESHOLD = 54;
const MAX_CANDIDATES = 3;

/**
 * Rank up to three active employees as plausible OCR matches.
 * Never includes inactive employees. Never invents roster identities.
 */
export function suggestActiveRosterCandidates(
  query: string,
  employees: Employee[],
  opts?: { includeInactive?: boolean; limit?: number }
): string[] {
  const q = normalize(query);
  if (!q) return [];
  const pool = activePool(employees, opts);
  const scores = new Map<string, number>();

  // Known OCR confusions that are NOT permanent aliases — per-mark suggestions only.
  // Inactive names never appear as candidates.
  // When a dedicated confusion token matches, return those suggestions only so
  // soft edit-distance (john↔jenn) does not dilute the Jordan path.
  const specialOnly =
    /^(john|johan|jorhan|jordon|jordn|joran|malia|maliyah|nalia|naliayh|naliaya|mia)$/.test(q);
  const special = specialOcrSuggestions(q, pool);
  if (specialOnly && special.length > 0) {
    return special
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, opts?.limit ?? MAX_CANDIDATES)
      .map((s) => s.id);
  }

  for (const emp of pool) {
    const s = scoreEmployeeAgainstQuery(q, emp);
    if (s >= SUGGEST_THRESHOLD) {
      scores.set(emp.id, Math.max(scores.get(emp.id) ?? 0, s));
    }
  }
  for (const s of special) {
    scores.set(s.id, Math.max(scores.get(s.id) ?? 0, s.score));
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, opts?.limit ?? MAX_CANDIDATES)
    .map(([id]) => id);
}

function withHeadline(
  result: NameMatchResult,
  employees: Employee[]
): NameMatchResult {
  if (result.status === "exact") return result;
  const ids = result.employeeIds.filter((id) =>
    employees.some((e) => e.id === id && e.status === "active")
  );
  const headline = formatOcrReviewHeadline(employees, ids);
  return {
    ...result,
    employeeIds: ids,
    reviewHeadline: headline,
    message: result.message ?? headline,
  };
}

/**
 * Resolve a handwritten/printed name against the ACTIVE roster.
 * - Exact token / unique first / unique last → exact (auto-apply eligible)
 * - Multiple clear matches or strong OCR lookalikes → ambiguous (≤3 candidates)
 * - No support → unknown / "Unrecognized mark"
 *
 * Never silently picks closest spelling as exact. Never creates/reactivates employees.
 * Does not use usual workdays. Does not write permanent aliases from OCR strings.
 */
export function resolveEmployeeName(
  query: string,
  employees: Employee[],
  opts?: { includeInactive?: boolean }
): NameMatchResult {
  const q = normalize(query);
  if (!q) {
    return {
      status: "unknown",
      employeeIds: [],
      query,
      message: "Empty name",
      reviewHeadline: "Unrecognized mark",
    };
  }

  const pool = activePool(employees, opts);

  // Bare "Mia" is never an auto-exact roster hit — manager reported false-positive offs.
  if (q === "mia") {
    return withHeadline(
      {
        status: "ambiguous",
        employeeIds: suggestActiveRosterCandidates(query, employees, opts),
        query,
        message:
          "“Mia” is not an active roster name — choose who this mark refers to, or dismiss.",
      },
      employees
    );
  }

  // Shared historical label — unresolved
  if (q === "lexy/brooke" || q === "lexi/brooke" || q === "lexy brooke") {
    const ids = pool
      .filter((e) => e.sharedHistoricalLabel === "Lexy/Brooke")
      .map((e) => e.id)
      .slice(0, MAX_CANDIDATES);
    return withHeadline(
      {
        status: "ambiguous",
        employeeIds: ids,
        query,
        message:
          "Lexy/Brooke is a shared historical label. Lexi and Brooke are separate people — choose who this entry refers to.",
      },
      employees
    );
  }

  const exact: Employee[] = [];
  for (const e of pool) {
    const tokens = collectTokens(e);
    if (tokens.includes(q)) exact.push(e);
  }

  // First name only — may be ambiguous (Brady)
  if (exact.length === 0) {
    const byFirst = pool.filter((e) => e.firstName && normalize(e.firstName) === q);
    if (byFirst.length === 1) {
      return {
        status: "exact",
        employeeIds: [byFirst[0]!.id],
        query,
      };
    }
    if (byFirst.length > 1) {
      return withHeadline(
        {
          status: "ambiguous",
          employeeIds: byFirst.map((e) => e.id).slice(0, MAX_CANDIDATES),
          query,
          message: `"${query}" matches more than one person. Choose the correct employee.`,
        },
        employees
      );
    }
  }

  if (exact.length === 1) {
    return { status: "exact", employeeIds: [exact[0]!.id], query };
  }
  if (exact.length > 1) {
    const uniqueIds = [...new Set(exact.map((e) => e.id))];
    if (uniqueIds.length === 1) {
      return { status: "exact", employeeIds: uniqueIds, query };
    }
    return withHeadline(
      {
        status: "ambiguous",
        employeeIds: uniqueIds.slice(0, MAX_CANDIDATES),
        query,
        message: `"${query}" matches more than one person.`,
      },
      employees
    );
  }

  // Last name unique match
  const byLast = pool.filter((e) => e.lastName && normalize(e.lastName) === q);
  if (byLast.length === 1) {
    return { status: "exact", employeeIds: [byLast[0]!.id], query };
  }
  if (byLast.length > 1) {
    return withHeadline(
      {
        status: "ambiguous",
        employeeIds: byLast.map((e) => e.id).slice(0, MAX_CANDIDATES),
        query,
        message: `"${query}" matches more than one last name on the roster.`,
      },
      employees
    );
  }

  // Soft active-roster suggestions (OCR lookalikes) — never auto-exact
  const suggested = suggestActiveRosterCandidates(query, employees, opts);
  if (suggested.length > 0) {
    return withHeadline(
      {
        status: "ambiguous",
        employeeIds: suggested,
        query,
        message: formatOcrReviewHeadline(employees, suggested),
      },
      employees
    );
  }

  return {
    status: "unknown",
    employeeIds: [],
    query,
    message: "Unrecognized mark",
    reviewHeadline: "Unrecognized mark",
  };
}

/** Never credit both Lexi and Brooke for the same shift. */
export function assertNotDoubleAssignedShared(
  employeeIds: Array<string | null | undefined>
): { ok: boolean; message?: string } {
  const set = new Set(employeeIds.filter(Boolean));
  if (set.has("emp_lexi") && set.has("emp_brooke")) {
    return {
      ok: false,
      message:
        "Lexi and Brooke cannot both be credited for the same unresolved Lexy/Brooke assignment.",
    };
  }
  return { ok: true };
}
