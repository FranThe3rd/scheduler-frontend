/**
 * Full calendar extraction score — correct / missing / extra / wrong identity / wrong date.
 * Used for Sep 14–20 (and similar) review; never embed expected answers in OCR prompts.
 */

export type CalendarMark = {
  employeeId: string;
  date: string;
  /** Optional raw OCR name for wrong-identity diagnostics */
  rawName?: string;
};

export type CalendarScore = {
  correct: CalendarMark[];
  missing: CalendarMark[];
  extra: CalendarMark[];
  wrongIdentity: Array<{ date: string; expectedId: string; gotId: string; rawName?: string }>;
  wrongDate: Array<{ employeeId: string; expectedDate: string; gotDate: string; rawName?: string }>;
  unresolved: Array<{ rawName: string; date: string }>;
  /** True positives / (TP + FN + FP + wrong) for the full set */
  precisionRecall: {
    truePositive: number;
    falseNegative: number;
    falsePositive: number;
    score: number;
  };
};

function key(employeeId: string, date: string) {
  return `${employeeId}|${date}`;
}

/**
 * Score extracted offs against a reviewed ground-truth set.
 * A false-positive (extra) counts as an error — including inventing Mia.
 */
export function scoreCalendarMarks(args: {
  expected: CalendarMark[];
  extracted: CalendarMark[];
  unresolved?: Array<{ rawName: string; date: string }>;
}): CalendarScore {
  const expectedKeys = new Map(args.expected.map((m) => [key(m.employeeId, m.date), m]));
  const extractedKeys = new Map(args.extracted.map((m) => [key(m.employeeId, m.date), m]));

  const correct: CalendarMark[] = [];
  const missing: CalendarMark[] = [];
  const extra: CalendarMark[] = [];
  const wrongIdentity: CalendarScore["wrongIdentity"] = [];
  const wrongDate: CalendarScore["wrongDate"] = [];

  for (const [k, exp] of expectedKeys) {
    if (extractedKeys.has(k)) {
      correct.push(exp);
      continue;
    }
    // Same employee, different date?
    const sameEmp = args.extracted.filter((e) => e.employeeId === exp.employeeId);
    if (sameEmp.length === 1 && !expectedKeys.has(key(sameEmp[0]!.employeeId, sameEmp[0]!.date))) {
      wrongDate.push({
        employeeId: exp.employeeId,
        expectedDate: exp.date,
        gotDate: sameEmp[0]!.date,
        rawName: sameEmp[0]!.rawName,
      });
      continue;
    }
    // Same date, different employee?
    const sameDate = args.extracted.filter((e) => e.date === exp.date);
    const unmatchedSameDate = sameDate.find(
      (e) => !expectedKeys.has(key(e.employeeId, e.date))
    );
    if (unmatchedSameDate) {
      wrongIdentity.push({
        date: exp.date,
        expectedId: exp.employeeId,
        gotId: unmatchedSameDate.employeeId,
        rawName: unmatchedSameDate.rawName,
      });
      continue;
    }
    missing.push(exp);
  }

  for (const [k, got] of extractedKeys) {
    if (expectedKeys.has(k)) continue;
    // Already counted as wrongDate / wrongIdentity?
    if (
      wrongDate.some(
        (w) => w.employeeId === got.employeeId && w.gotDate === got.date
      ) ||
      wrongIdentity.some((w) => w.gotId === got.employeeId && w.date === got.date)
    ) {
      continue;
    }
    extra.push(got);
  }

  const truePositive = correct.length;
  const falseNegative = missing.length + wrongDate.length + wrongIdentity.length;
  const falsePositive = extra.length;
  const denom = truePositive + falseNegative + falsePositive;
  const score = denom === 0 ? 1 : truePositive / denom;

  return {
    correct,
    missing,
    extra,
    wrongIdentity,
    wrongDate,
    unresolved: args.unresolved ?? [],
    precisionRecall: {
      truePositive,
      falseNegative,
      falsePositive,
      score,
    },
  };
}
