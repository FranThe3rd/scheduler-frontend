/**
 * Split OCR rows that incorrectly combined multiple roster first names
 * into one string (e.g. "Addison Jordan Jenn" → three entries).
 * Never splits a real full name when tokens aren't multiple distinct people.
 * Unknown tokens become separate reviewable entries (never auto-created employees).
 */
import type { Employee } from "./types";
import type { OcrEntry } from "./ocrTypes";

function buildFirstTokenMap(employees: Employee[]): Map<string, string | null> {
  const firstToId = new Map<string, string | null>();

  function setToken(token: string, id: string) {
    const key = token.toLowerCase().trim();
    if (!key || key.includes(" ")) return;
    if (firstToId.has(key) && firstToId.get(key) !== id) {
      firstToId.set(key, null); // ambiguous
    } else if (!firstToId.has(key)) {
      firstToId.set(key, id);
    }
  }

  for (const e of employees.filter((x) => x.status === "active")) {
    if (e.firstName) setToken(e.firstName, e.id);
    for (const a of e.aliases ?? []) {
      if (!a.confirmed) continue;
      if (/\s/.test(a.alias) || a.alias.length < 2) continue;
      const looksLikeSurnameOnly =
        e.lastName && a.alias.toLowerCase() === e.lastName.toLowerCase();
      if (looksLikeSurnameOnly) continue;
      setToken(a.alias, e.id);
    }
  }
  return firstToId;
}

export function splitSuspiciousCombinedNames(
  entries: OcrEntry[],
  employees: Employee[]
): OcrEntry[] {
  const firstToId = buildFirstTokenMap(employees);

  const out: OcrEntry[] = [];
  for (const entry of entries) {
    const raw = (entry.rawName ?? "").trim();
    if (!raw) {
      out.push(entry);
      continue;
    }
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) {
      out.push(entry);
      continue;
    }

    const resolved = tokens.map((t) => {
      const id = firstToId.get(t.toLowerCase());
      if (typeof id === "string" && id.length > 0) return { token: t, id };
      if (id === null) return { token: t, id: null as string | null }; // ambiguous
      return { token: t, id: undefined as string | null | undefined };
    });

    const uniqueExactIds = [
      ...new Set(resolved.map((r) => r.id).filter((id): id is string => typeof id === "string")),
    ];
    const hasAmbiguous = resolved.some((r) => r.id === null);
    // Require at least two distinct roster people before splitting a multi-token string.
    // Unknown tokens are kept as separate review rows; ambiguous tokens block the split
    // so we don't tear apart "Brady Dosedlo"-style full names incorrectly.
    const shouldSplit =
      uniqueExactIds.length >= 2 &&
      !hasAmbiguous &&
      uniqueExactIds.length === new Set(uniqueExactIds).size;

    if (shouldSplit) {
      for (const r of resolved) {
        if (typeof r.id === "string") {
          out.push({
            ...entry,
            rawName: r.token,
            matchStatus: "exact",
            employeeIds: [r.id],
            matchMessage: `Split from combined reading "${raw}"`,
            needsReview: false,
            uncertain: false,
          });
        } else {
          out.push({
            ...entry,
            rawName: r.token,
            matchStatus: "unknown",
            employeeIds: [],
            matchMessage: `Unknown name from combined reading "${raw}" — identify or dismiss`,
            needsReview: true,
            uncertain: true,
          });
        }
      }
      continue;
    }

    out.push(entry);
  }
  return out;
}

/** True when rawName looks like placeholder metadata, not a person. */
export function isNonIdentityRawName(raw: string): boolean {
  return /^(?:—+|-+|\[?\s*scribble\s*\]?|illegible|unreadable|crossed\s*out|cross\s*out|x+)$/i.test(
    raw.trim()
  );
}
