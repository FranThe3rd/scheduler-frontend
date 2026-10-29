/**
 * Post-OCR match collapsing: one handwritten signature → one review row.
 * Uses date + resolved employee id (and fragment heuristics), not fuzzy name alone.
 * Uncertain / crossed-out flags are preserved for manager review.
 */

export type MatchableOcrRow = {
  rawName: string;
  date?: string;
  weekday?: string;
  note?: string;
  kindHint?: string;
  crossedOut?: boolean;
  uncertain?: boolean;
  needsReview?: boolean;
  matchStatus?: "exact" | "ambiguous" | "unknown" | string;
  employeeIds?: string[];
  matchMessage?: string;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[.]/g, "").replace(/\s+/g, " ").trim();
}

function bradyishToken(t: string): boolean {
  return t === "brady" || t === "brody";
}

function dologish(s: string): boolean {
  return /oll?ogite|dologite|dologits/.test(s);
}

/** True when two OCR strings look like first/last fragments of Brady Dol. */
export function looksLikeBradyDologitePair(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  const aBrady = /\b(brady|brody)\b/.test(na);
  const bBrady = /\b(brady|brody)\b/.test(nb);
  const aDolo = dologish(na);
  const bDolo = dologish(nb);
  // One side is Brady/Brody fragment, the other is a Dologite/Ollogite surname reading
  if ((aBrady && bDolo) || (bBrady && aDolo)) return true;
  // Already-joined reading + leftover fragment of the same person
  if ((aBrady && aDolo && (bBrady || bDolo)) || (bBrady && bDolo && (aBrady || aDolo))) {
    return looksLikeFragments(a, b);
  }
  return false;
}

function looksLikeFragments(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(" ").filter(Boolean);
  const tb = nb.split(" ").filter(Boolean);
  // One token appears inside the other multi-token reading
  if (ta.length === 1 && tb.includes(ta[0]!)) return true;
  if (tb.length === 1 && ta.includes(tb[0]!)) return true;
  // Brady / Brody (+ optional initial) against a Dologite/Ologite/Ollogite reading
  if (ta.some(bradyishToken) && dologish(nb)) return true;
  if (tb.some(bradyishToken) && dologish(na)) return true;
  if (ta.length === 1 && bradyishToken(ta[0]!) && (tb.some(bradyishToken) || dologish(nb)))
    return true;
  if (tb.length === 1 && bradyishToken(tb[0]!) && (ta.some(bradyishToken) || dologish(na)))
    return true;
  // Do NOT merge two unrelated single-token first names (Addison + Jordan)
  if (ta.length === 1 && tb.length === 1) return false;
  return false;
}

function preferRawName(a: string, b: string): string {
  const multi = [a, b].filter((n) => /\s/.test(n.trim()));
  if (multi.length) return multi.sort((x, y) => y.length - x.length)[0]!;
  if (norm(a).includes(norm(b))) return a;
  if (norm(b).includes(norm(a))) return b;
  // Reading order: shorter first token often first name
  return `${a.trim()} ${b.trim()}`.replace(/\s+/g, " ").trim();
}

function mergeRows<T extends MatchableOcrRow>(a: T, b: T): T {
  const rawName = preferRawName(a.rawName, b.rawName);
  const exactIds =
    a.matchStatus === "exact" && a.employeeIds?.length === 1
      ? a.employeeIds
      : b.matchStatus === "exact" && b.employeeIds?.length === 1
        ? b.employeeIds
        : a.employeeIds?.length === 1
          ? a.employeeIds
          : b.employeeIds;
  const matchStatus =
    a.matchStatus === "exact" || b.matchStatus === "exact"
      ? "exact"
      : a.matchStatus === "ambiguous" || b.matchStatus === "ambiguous"
        ? "ambiguous"
        : a.matchStatus ?? b.matchStatus;
  return {
    ...a,
    ...b,
    rawName,
    note: a.note || b.note,
    kindHint: a.kindHint || b.kindHint,
    crossedOut: Boolean(a.crossedOut || b.crossedOut),
    uncertain: Boolean(
      a.uncertain ||
        b.uncertain ||
        norm(a.rawName) !== norm(rawName) ||
        norm(b.rawName) !== norm(rawName)
    ),
    needsReview: true,
    matchStatus,
    employeeIds: exactIds ?? a.employeeIds ?? b.employeeIds,
    matchMessage: a.matchMessage || b.matchMessage,
  };
}

function exactId(row: MatchableOcrRow): string | undefined {
  return row.matchStatus === "exact" && row.employeeIds?.length === 1
    ? row.employeeIds[0]
    : undefined;
}

/**
 * Collapse duplicate / fragmented OCR rows for the same date:
 * - Multiple exact matches to the same employee id → one row
 * - Ambiguous/unknown Brady + Ollogite/Ologite fragments → one Brady Dol. row
 * Crossed-out vs clear marks for the same person stay separate when crossedOut differs.
 */
export function collapseDuplicateOcrMatches<T extends MatchableOcrRow>(entries: T[]): T[] {
  const byDate = new Map<string, T[]>();
  const noDate: T[] = [];
  for (const e of entries) {
    if (!e.date) {
      noDate.push(e);
      continue;
    }
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  const out: T[] = [...noDate];
  for (const [, rows] of byDate) {
    const used = new Set<number>();
    const collapsed: T[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (used.has(i)) continue;
      let cur = rows[i]!;
      used.add(i);
      let grew = true;
      while (grew) {
        grew = false;
        for (let j = 0; j < rows.length; j++) {
          if (used.has(j)) continue;
          const other = rows[j]!;
          if (Boolean(cur.crossedOut) !== Boolean(other.crossedOut)) continue;

          const curExact = exactId(cur);
          const otherExact = exactId(other);

          // Same exact employee on the same date
          if (curExact && otherExact && curExact === otherExact) {
            cur = mergeRows(cur, other);
            used.add(j);
            grew = true;
            continue;
          }

          // Ambiguous fragment + exact (e.g. "Brady" + "Ologite"/"Brody Ologite")
          if (
            curExact &&
            other.matchStatus === "ambiguous" &&
            other.employeeIds?.includes(curExact) &&
            looksLikeFragments(cur.rawName, other.rawName)
          ) {
            cur = mergeRows(cur, other);
            used.add(j);
            grew = true;
            continue;
          }
          if (
            otherExact &&
            cur.matchStatus === "ambiguous" &&
            cur.employeeIds?.includes(otherExact) &&
            looksLikeFragments(cur.rawName, other.rawName)
          ) {
            cur = mergeRows(cur, other);
            used.add(j);
            grew = true;
            continue;
          }

          // Exact Brady Dol. + unknown "B. Brady" / Brady fragment (demonstrated case)
          if (
            (curExact === "emp_brady_dologite" || otherExact === "emp_brady_dologite") &&
            looksLikeBradyDologitePair(cur.rawName, other.rawName)
          ) {
            cur = mergeRows(cur, other);
            // Force Brady Dol. identity — never Brady Dos.
            cur = {
              ...cur,
              matchStatus: "exact",
              employeeIds: ["emp_brady_dologite"],
              matchMessage: undefined,
            };
            used.add(j);
            grew = true;
            continue;
          }

          // Two unknowns/fragments on same date that clearly compose Brady Dol.
          if (!curExact && !otherExact && looksLikeBradyDologitePair(cur.rawName, other.rawName)) {
            cur = mergeRows(cur, other);
            cur = {
              ...cur,
              matchStatus: "exact",
              employeeIds: ["emp_brady_dologite"],
              matchMessage: undefined,
            };
            used.add(j);
            grew = true;
          }
        }
      }
      collapsed.push(cur);
    }
    out.push(...collapsed);
  }

  return out;
}

/** Stable key for dismiss / dedupe of an extraction mark. */
export function extractionDismissKey(rawName: string, date?: string): string {
  return `${norm(rawName)}|${date ?? ""}`;
}
