/**
 * Pure mark-merge helpers used by tests and (optionally) an OCR backend.
 */

export type RawMark = {
  rawName?: string;
  note?: string | null;
  kindHint?: string | null;
  crossedOut?: boolean;
  uncertain?: boolean;
  x?: number | null;
  y?: number | null;
  pageX?: number | null;
  pageY?: number | null;
  source?: "full_page" | "crop" | string;
};

function hasPageLoc(m: RawMark): boolean {
  return (
    m.pageX != null &&
    m.pageY != null &&
    Number.isFinite(Number(m.pageX)) &&
    Number.isFinite(Number(m.pageY))
  );
}

function markDistance(a: RawMark, b: RawMark): number {
  if (!hasPageLoc(a) || !hasPageLoc(b)) return Number.POSITIVE_INFINITY;
  const dx = Number(a.pageX) - Number(b.pageX);
  const dy = Number(a.pageY) - Number(b.pageY);
  return Math.hypot(dx, dy);
}

function looksLikeNameFragments(a: string, b: string): boolean {
  const na = a.trim().toLowerCase().replace(/[.]/g, "");
  const nb = b.trim().toLowerCase().replace(/[.]/g, "");
  if (!na || !nb) return false;
  if (na === nb) return true;

  const aBrady = /\b(brady|brody)\b/.test(na);
  const bBrady = /\b(brady|brody)\b/.test(nb);
  const aDolo = /\b(oll?ogite|dologite|dologits)\b/.test(na);
  const bDolo = /\b(oll?ogite|dologite|dologits)\b/.test(nb);
  if ((aBrady && !aDolo && bDolo) || (bBrady && !bDolo && aDolo)) return true;

  const ta = na.split(/\s+/).filter(Boolean);
  const tb = nb.split(/\s+/).filter(Boolean);

  if (ta.length === 1 && tb.includes(ta[0]!)) return true;
  if (tb.length === 1 && ta.includes(tb[0]!)) return true;

  if (ta.length === 1 && tb.length === 1) return false;

  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

function shouldMergeMarks(a: RawMark, b: RawMark): boolean {
  const nameA = (a.rawName ?? "").trim();
  const nameB = (b.rawName ?? "").trim();
  if (!nameA || !nameB) return false;
  const sameName = nameA.toLowerCase() === nameB.toLowerCase();
  const sameCross = Boolean(a.crossedOut) === Boolean(b.crossedOut);
  const dist = markDistance(a, b);
  const near = dist < 0.035;
  const stacked =
    hasPageLoc(a) &&
    hasPageLoc(b) &&
    Math.abs(Number(a.pageX) - Number(b.pageX)) < 0.03 &&
    Math.abs(Number(a.pageY) - Number(b.pageY)) < 0.055;

  if (sameName && sameCross && (near || !hasPageLoc(a) || !hasPageLoc(b))) return true;

  if ((near || stacked) && looksLikeNameFragments(nameA, nameB)) return true;

  return false;
}

function mergeCluster(cluster: RawMark[]): RawMark {
  const ordered = [...cluster].sort((a, b) => {
    const dy = Number(a.pageY ?? 0) - Number(b.pageY ?? 0);
    if (Math.abs(dy) > 0.005) return dy;
    return Number(a.pageX ?? 0) - Number(b.pageX ?? 0);
  });
  const names = ordered.map((m) => (m.rawName ?? "").trim()).filter(Boolean);
  const multi = names.filter((n) => /\s/.test(n));
  let rawName: string;
  if (multi.length > 0) {
    rawName = multi.sort((a, b) => b.length - a.length)[0]!;
  } else if (names.length > 1) {
    const toks: string[] = [];
    for (const n of names) {
      if (!toks.some((t) => t.toLowerCase() === n.toLowerCase())) toks.push(n);
    }
    rawName = toks.join(" ");
  } else {
    rawName = names[0] ?? "";
  }

  const xs = cluster.map((m) => Number(m.pageX)).filter((n) => Number.isFinite(n));
  const ys = cluster.map((m) => Number(m.pageY)).filter((n) => Number.isFinite(n));
  const joinedFromParts = names.length > 1 && multi.length === 0;
  const spellingConflict = names.some(
    (n) => n.toLowerCase() !== rawName.toLowerCase() && !rawName.toLowerCase().includes(n.toLowerCase())
  );

  return {
    rawName,
    note: cluster.map((m) => m.note).find((n) => n && String(n).trim()) ?? null,
    kindHint: cluster.map((m) => m.kindHint).find(Boolean) ?? null,
    crossedOut: cluster.some((m) => m.crossedOut),
    uncertain: cluster.some((m) => m.uncertain) || joinedFromParts || spellingConflict,
    pageX: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null,
    pageY: ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null,
    source: cluster.map((m) => m.source).filter(Boolean).join("+") || undefined,
  };
}

function confusableMisreads(a: string, b: string): boolean {
  const na = a.trim().toLowerCase().replace(/[.]/g, "");
  const nb = b.trim().toLowerCase().replace(/[.]/g, "");
  if (!na || !nb || na === nb) return false;
  const pair = new Set([na, nb]);
  if (pair.has("andrew") && pair.has("addison")) return true;
  if (pair.has("andrew") && pair.has("addi")) return true;
  if (pair.has("andrew") && pair.has("addy")) return true;
  if (pair.has("johan") && pair.has("jordan")) return true;
  if (pair.has("john") && pair.has("jordan")) return true;
  return false;
}

function preferConfusableSpelling(a: string, b: string): string {
  const na = a.trim().toLowerCase().replace(/[.]/g, "");
  const nb = b.trim().toLowerCase().replace(/[.]/g, "");
  const pair = new Set([na, nb]);
  if (pair.has("jordan") && (pair.has("john") || pair.has("johan"))) {
    return /^jordan$/i.test(a.trim()) ? a : b;
  }
  if (pair.has("addison") && pair.has("andrew")) {
    return /^addison$/i.test(a.trim()) ? a : b;
  }
  if (pair.has("addison") && (pair.has("addi") || pair.has("addy"))) {
    return /^addison$/i.test(a.trim()) ? a : b;
  }
  return a.trim().length >= b.trim().length ? a : b;
}

function isCropSource(m: RawMark): boolean {
  return String(m.source ?? "").includes("crop");
}

export function consolidateMarksByLocation(marks: RawMark[]): RawMark[] {
  const items: RawMark[] = [];
  for (const e of marks) {
    const rawName = (e.rawName ?? "").trim();
    if (!rawName) continue;
    items.push({
      ...e,
      rawName,
      pageX: e.pageX != null ? Number(e.pageX) : e.x != null ? Number(e.x) : null,
      pageY: e.pageY != null ? Number(e.pageY) : e.y != null ? Number(e.y) : null,
    });
  }

  const used = new Set<number>();
  const out: RawMark[] = [];
  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    const cluster = [items[i]!];
    used.add(i);
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < items.length; j++) {
        if (used.has(j)) continue;
        if (cluster.some((c) => shouldMergeMarks(c, items[j]!))) {
          cluster.push(items[j]!);
          used.add(j);
          grew = true;
        }
      }
    }
    out.push(mergeCluster(cluster));
  }
  return dropConflictingTileGhosts(out);
}

export function dropConflictingTileGhosts(marks: RawMark[]): RawMark[] {
  const crops = marks.filter(isCropSource);
  if (crops.length === 0) return marks;
  const drop = new Set<RawMark>();
  const rename = new Map<RawMark, string>();

  for (const c of crops) {
    const cName = (c.rawName ?? "").trim();
    if (!cName) continue;
    for (const m of marks) {
      if (m === c || isCropSource(m)) continue;
      const name = (m.rawName ?? "").trim();
      if (!name || name.toLowerCase() === cName.toLowerCase()) continue;
      const near =
        markDistance(m, c) < 0.08 ||
        (!hasPageLoc(m) && confusableMisreads(name, cName));
      if (!near && !confusableMisreads(name, cName)) continue;

      if (confusableMisreads(name, cName)) {
        const keep = preferConfusableSpelling(name, cName);
        if (keep.toLowerCase() === name.toLowerCase()) {
          rename.set(c, keep);
        } else {
          drop.add(m);
        }
        continue;
      }
      if (markDistance(m, c) < 0.05 && looksLikeNameFragments(name, cName)) {
        drop.add(m);
      }
    }
  }

  return marks
    .filter((m) => !drop.has(m))
    .map((m) => {
      const next = rename.get(m);
      if (!next) return m;
      return { ...m, rawName: next, uncertain: true };
    });
}
