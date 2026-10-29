import type { Employee } from "./types";
import { applyOct5PatternEvidence } from "./seed/oct5History";

function ensureAlias(emp: Employee, alias: string, confirmed = false): void {
  emp.aliases = emp.aliases ?? [];
  const norm = alias.toLowerCase();
  if (!emp.aliases.some((a) => a.alias.toLowerCase() === norm)) {
    emp.aliases.push({ alias, confirmed });
  }
}

/** Apply confirmed manager corrections to persisted employee DNA (idempotent). */
export function applyManagerDnaCorrections(employees: Employee[]): void {
  for (const emp of employees) {
    if (!emp?.dna) continue;
    emp.dna.commonShiftTypes = emp.dna.commonShiftTypes ?? [];
    emp.context = emp.context ?? { notes: [], circumstances: [] };
    emp.context.notes = emp.context.notes ?? [];
    emp.context.circumstances = emp.context.circumstances ?? [];
    emp.aliases = emp.aliases ?? [];

    // Same employee ID: Addison / Addi / Addy — do not create duplicates
    if (emp.id === "emp_addy_giesler") {
      emp.firstName = "Addison";
      emp.displayName = "Addison Giesler";
      // Keep existing last name; do not invent one
      if (!emp.lastName) emp.lastName = "Giesler";
      emp.firstNameConfirmed = true;
      emp.lastNameConfirmed = true;
      emp.initials = "AG";
      ensureAlias(emp, "Addison", true);
      ensureAlias(emp, "Addi", true);
      ensureAlias(emp, "Addy", true);
      ensureAlias(emp, "Giesler", true);
      if (!emp.context.notes.some((n) => n.includes("Addison / Addi / Addy"))) {
        emp.context.notes.push(
          "First-name spellings Addison / Addi / Addy linked to the same employee; school status unconfirmed."
        );
      }
    }

    // Brady Dologite OCR variants — never conflate with Brady Dosedlo.
    // Phonetic surname spellings are aliases only; stored surname stays until verified.
    if (emp.id === "emp_brady_dologite") {
      ensureAlias(emp, "Brady Dologite", true);
      ensureAlias(emp, "Dologite", true);
      ensureAlias(emp, "Ologite", false);
      ensureAlias(emp, "Ollogite", false);
      ensureAlias(emp, "Brody Ologite", false);
      ensureAlias(emp, "Brady Ologite", false);
      ensureAlias(emp, "Brody Dologite", false);
      ensureAlias(emp, "B. Ologite", false);
      ensureAlias(emp, "B Ologite", false);
      ensureAlias(emp, "B. Ollogite", false);
      if (!emp.context.notes.some((n) => n.includes("Ologite"))) {
        emp.context.notes.push(
          "OCR variants Ologite / Ollogite / Brody Ologite map to Brady Dologite — distinct from Brady Dosedlo. Stored surname unchanged pending spelling verification."
        );
      }
    }

    // Andrew quit — keep any historical row inactive; never treat as scheduling candidate
    if (
      emp.id === "emp_andrew" ||
      /^andrew$/i.test(emp.firstName ?? "") ||
      /^andrew(\s|$)/i.test(emp.displayName ?? "")
    ) {
      emp.status = "inactive";
      emp.autoScheduleEnabled = false;
      if (!emp.context.notes.some((n) => n.includes("quit"))) {
        emp.context.notes.push("Andrew has quit — inactive; excluded from matching and generation.");
      }
    }

    if (emp.id === "emp_mike_wagner") {
      emp.autoScheduleEnabled = false;
      for (const st of emp.dna.commonShiftTypes) {
        if (st.startMinutes === 9 * 60 && st.endMinutes === 13 * 60) {
          st.autoScheduleDisabled = true;
          st.notes =
            st.notes ??
            "Historical Saturday 9–1 — disabled for auto-schedule pending clarification.";
        }
        // Disable all Mike DNA patterns for auto-schedule
        st.autoScheduleDisabled = true;
      }
      emp.dna.managerOverrides = emp.dna.managerOverrides ?? [];
      if (!emp.dna.managerOverrides.some((n: string) => n.includes("autoScheduleEnabled"))) {
        emp.dna.managerOverrides.push(
          "autoScheduleEnabled=false — generator never assigns Mike; manual/locked only."
        );
      }
      if (!emp.dna.managerOverrides.some((n: string) => n.includes("Saturday 9–1"))) {
        emp.dna.managerOverrides.push(
          "Manager correction: Saturday 9–1 is NOT an automatic candidate pending clarification of Mike’s current hours."
        );
      }
      if (emp.dna.workload) {
        emp.dna.workload.uncertaintyNotes = emp.dna.workload.uncertaintyNotes ?? [];
        if (!emp.dna.workload.uncertaintyNotes.some((n) => n.includes("Saturday 9–1"))) {
          emp.dna.workload.uncertaintyNotes.push(
            "Manager correction: Saturday 9–1 disabled for auto-schedule."
          );
        }
      }
    }

    if (emp.id === "emp_marques_enriquez") {
      emp.dna.commonShiftTypes = emp.dna.commonShiftTypes.filter(
        (st) => !(st.startMinutes === 9 * 60 && st.endMinutes === 13 * 60) && st.startMinutes >= 12 * 60
      );
      if (!emp.context.circumstances.includes("Does not work 9–1 openings")) {
        emp.context.circumstances.push("Does not work 9–1 openings");
      }
      if (!emp.context.notes.some((n) => n.includes("9 AM–1 PM"))) {
        emp.context.notes.push("Manager confirmation: does NOT work 9 AM–1 PM opening shifts.");
      }
      const has16 = emp.dna.commonShiftTypes.some(
        (st) => st.startMinutes === 13 * 60 && st.endMinutes === 18 * 60
      );
      const has36 = emp.dna.commonShiftTypes.some(
        (st) => st.startMinutes === 15 * 60 && st.endMinutes === 18 * 60
      );
      if (!has16) {
        emp.dna.commonShiftTypes.unshift({
          startMinutes: 13 * 60,
          endMinutes: 18 * 60,
          dayHints: ["tuesday", "thursday", "wednesday"],
          weeksObserved: 4,
          notes: "Primary usual shift 1–6 PM",
        });
      }
      if (!has36) {
        emp.dna.commonShiftTypes.push({
          startMinutes: 15 * 60,
          endMinutes: 18 * 60,
          dayHints: ["tuesday", "thursday"],
          weeksObserved: 4,
          notes: "Alternate usual shift 3–6 PM — not combined with 1–6 same day",
        });
      }
    }

    // Jenn Stone — preferred spelling; Jen remains an alias for the same ID
    if (emp.id === "emp_jenn_stone") {
      emp.firstName = "Jenn";
      emp.displayName = "Jenn Stone";
      emp.firstNameConfirmed = true;
      emp.lastNameConfirmed = true;
      ensureAlias(emp, "Jen", true);
      ensureAlias(emp, "Jenn", true);
      ensureAlias(emp, "Stone", true);
    }

    // Jordan Roman — calendar "Jordan" is historical J. Roman (never invent Josh)
    if (emp.id === "emp_josh_roman") {
      emp.firstName = "Jordan";
      emp.lastName = "Roman";
      emp.displayName = "Jordan Roman";
      emp.printedLabel = "J. Roman";
      emp.firstNameConfirmed = true;
      emp.lastNameConfirmed = true;
      // Drop incorrect Josh identity
      emp.aliases = (emp.aliases ?? []).filter((a) => !/^josh$/i.test(a.alias));
      ensureAlias(emp, "Jordan", true);
      ensureAlias(emp, "Jordan Roman", true);
      ensureAlias(emp, "J. Roman", true);
      ensureAlias(emp, "Roman", true);
      // Remove superseded “never map John” note
      emp.context.notes = emp.context.notes.filter(
        (n) => !/do not map unidentified john/i.test(n)
      );
      if (!emp.context.notes.some((n) => n.includes("calendar Jordan"))) {
        emp.context.notes.push(
          "Confirmed: calendar Jordan is the same person as historical J. Roman / Jordan Roman."
        );
      }
    }

    // Tom DeAngelis — Tommy / Thomas / T. DeAngelis are confirmed aliases
    if (emp.id === "emp_tom_deangelis") {
      ensureAlias(emp, "Tom", true);
      ensureAlias(emp, "Tommy", true);
      ensureAlias(emp, "Thomas", true);
      ensureAlias(emp, "T. DeAngelis", true);
      ensureAlias(emp, "DeAngelis", true);
    }

    // Kourtney — surname unconfirmed; display as Kourtney C.; never invent full surname
    if (emp.id === "emp_kourtney_cantrel") {
      emp.firstName = "Kourtney";
      emp.firstNameConfirmed = true;
      emp.lastNameConfirmed = false;
      emp.lastName = undefined;
      emp.displayName = "Kourtney";
      emp.printedLabel = "Kourtney";
      emp.aliases = (emp.aliases ?? []).filter(
        (a) => !/cangelosi|cantrel/i.test(a.alias)
      );
      ensureAlias(emp, "Courtney", true);
      ensureAlias(emp, "Kourtney", true);
      emp.context.notes = emp.context.notes.filter(
        (n) => !/Courtney’s surname|Kourtney’s surname/i.test(n)
      );
      if (!emp.context.notes.some((n) => n.includes("Kourtney C."))) {
        emp.context.notes.push(
          "Kourtney’s surname remains unconfirmed; display as Kourtney C. only — do not invent a full surname."
        );
      }
    }

    // Dante — Main is usual; occasional Lehi allowed (Oct 5–11: Thu noon–6 L).
    // Do not hard-ban Lehi; keep Main preference via scoring.
    if (emp.id === "emp_dante_smith") {
      emp.context.circumstances = emp.context.circumstances.filter(
        (c) => !/Main-only \(automatic\)/i.test(c)
      );
      emp.context.notes = emp.context.notes.filter(
        (n) => !/Main-only for automatic|never auto-assign to Lehi/i.test(n)
      );
      emp.dna.managerOverrides = (emp.dna.managerOverrides ?? []).filter(
        (n) => !/Main-only for automatic/i.test(n)
      );
      if (!emp.context.notes.some((n) => n.includes("occasional Lehi"))) {
        emp.context.notes.push(
          "Manager (Oct 2026): Main is usual; occasional Lehi is allowed (paper Thu noon–6 L). Not a routine daily Lehi worker."
        );
      }
      emp.dna.lehighEvidenceNotes = emp.dna.lehighEvidenceNotes ?? [];
      if (!emp.dna.lehighEvidenceNotes.some((n) => n.includes("Thu noon–6"))) {
        emp.dna.lehighEvidenceNotes.push(
          "Oct 5–11 paper: Thursday noon–6 L — occasional Lehi eligibility."
        );
      }
      const hasLehiPattern = emp.dna.commonShiftTypes.some(
        (st) => st.location === "lehigh"
      );
      if (!hasLehiPattern) {
        emp.dna.commonShiftTypes.push({
          startMinutes: 12 * 60,
          endMinutes: 18 * 60,
          location: "lehigh",
          dayHints: ["thursday"],
          weeksObserved: 1,
          notes: "Occasional Lehi daytime — Oct 5–11 Thu noon–6 L",
        });
      }
    }

    // Alex Cheatham — primarily Main; occasional Lehi (Oct paper Tue 1–6 L)
    if (emp.id === "emp_alex_cheatham") {
      emp.dna.lehighEvidenceNotes = emp.dna.lehighEvidenceNotes ?? [];
      if (!emp.dna.lehighEvidenceNotes.some((n) => n.includes("Tue 1–6"))) {
        emp.dna.lehighEvidenceNotes.push(
          "Oct 5–11 paper: Tuesday 1–6 L — occasional Lehi (manager-confirmed)."
        );
      }
      if (!emp.dna.commonShiftTypes.some((st) => st.location === "lehigh")) {
        emp.dna.commonShiftTypes.push({
          startMinutes: 13 * 60,
          endMinutes: 18 * 60,
          location: "lehigh",
          dayHints: ["tuesday"],
          weeksObserved: 1,
          notes: "Occasional Lehi — Oct Tue 1–6 L",
        });
      }
    }

    // Tyson — occasional Lehi closing (Oct paper Sat 6–10 L)
    if (emp.id === "emp_tyson_langensiepen") {
      emp.dna.lehighEvidenceNotes = emp.dna.lehighEvidenceNotes ?? [];
      if (!emp.dna.lehighEvidenceNotes.some((n) => n.includes("closing L"))) {
        emp.dna.lehighEvidenceNotes.push(
          "Oct 5–11 paper: Saturday 6–10 L — occasional Lehi closing."
        );
      }
      if (!emp.dna.commonShiftTypes.some((st) => st.location === "lehigh")) {
        emp.dna.commonShiftTypes.push({
          startMinutes: 18 * 60,
          endMinutes: 22 * 60,
          location: "lehigh",
          dayHints: ["saturday"],
          weeksObserved: 1,
          notes: "Occasional Lehi closing",
        });
      }
    }

    // F. Makary — printed first initial; McCurry/Macree spoken → this ID only
    if (emp.id === "emp_makary") {
      emp.displayName = "F. Makary";
      emp.printedLabel = "F. Makary";
      emp.firstName = "F.";
      emp.firstNameConfirmed = false;
      emp.lastName = "Makary";
      emp.lastNameConfirmed = true;
      ensureAlias(emp, "McCurry", false);
      ensureAlias(emp, "Macree", false);
      ensureAlias(emp, "Makary", true);
      ensureAlias(emp, "F. Makary", true);
      if (!emp.context.notes.some((n) => n.includes("McCurry"))) {
        emp.context.notes.push(
          "Manager spoken McCurry/Macree maps to existing F. Makary — do not create a new employee."
        );
      }
      if (!emp.context.notes.some((n) => n.includes("two Lehi daytime"))) {
        emp.context.notes.push(
          "Manager estimate: about two Lehi daytime shifts weekly — provisional preference, not guaranteed availability."
        );
      }
      // Prefer noon–5 daytime template from Oct paper pattern for Clausnitzer peer
      for (const st of emp.dna.commonShiftTypes) {
        if (st.location === "lehigh" && st.endMinutes === 16 * 60) {
          st.endMinutes = 17 * 60;
          st.notes = (st.notes ?? "") + " Prefer noon–5 daytime when available.";
        }
      }
    }

    // B. Clausnitzer — printed spelling; keep spoken Klauschnitzer as alias for confirmation
    if (emp.id === "emp_clausnitzer") {
      emp.displayName = "B. Clausnitzer";
      emp.printedLabel = "B. Clausnitzer";
      emp.firstName = "B.";
      emp.firstNameConfirmed = false;
      emp.lastName = "Clausnitzer";
      emp.lastNameConfirmed = true;
      ensureAlias(emp, "Clausnitzer", true);
      ensureAlias(emp, "B. Clausnitzer", true);
      ensureAlias(emp, "Klauschnitzer", false);
      if (!emp.context.notes.some((n) => n.includes("Klauschnitzer"))) {
        emp.context.notes.push(
          "Printed roster: Clausnitzer. Manager spoken Klauschnitzer — preserve discrepancy for spelling confirmation; do not create a second employee."
        );
      }
      if (!emp.dna.lehighEvidenceNotes.some((n) => n.includes("noon–5 L"))) {
        emp.dna.lehighEvidenceNotes.push(
          "Oct 5–11 paper: Mon/Wed/Fri noon–5 L — strong Lehi daytime preference."
        );
      }
      // Ensure noon–5 pattern
      const hasNoon5 = emp.dna.commonShiftTypes.some(
        (st) =>
          st.location === "lehigh" &&
          st.startMinutes === 12 * 60 &&
          st.endMinutes === 17 * 60
      );
      if (!hasNoon5) {
        emp.dna.commonShiftTypes.unshift({
          startMinutes: 12 * 60,
          endMinutes: 17 * 60,
          location: "lehigh",
          dayHints: ["monday", "wednesday", "friday"],
          weeksObserved: 1,
          notes: "Oct paper noon–5 L Mon/Wed/Fri",
        });
      }
    }

    // Brady Dol. — strong Lehi; Oct paper 5–10 Wed/Fri, 1–6 Sat/Sun
    if (emp.id === "emp_brady_dologite") {
      if (!emp.dna.lehighEvidenceNotes.some((n) => n.includes("Oct 5–11"))) {
        emp.dna.lehighEvidenceNotes.push(
          "Oct 5–11 paper: Wed/Fri 5–10 L; Sat/Sun 1–6 L — strong Lehi preference."
        );
      }
    }

    // Jordan — occasional Lehi evening ~1–2 weekly
    if (emp.id === "emp_josh_roman") {
      emp.dna.lehighEvidenceNotes = emp.dna.lehighEvidenceNotes ?? [];
      emp.dna.lehighEvidenceNotes = emp.dna.lehighEvidenceNotes.filter(
        (n) => !n.includes("usual Lehi staff")
      );
      if (!emp.dna.lehighEvidenceNotes.some((n) => n.includes("occasional Lehi evening"))) {
        emp.dna.lehighEvidenceNotes.push(
          "Manager: occasional Lehi evening, roughly one to two weekly shifts when available. Oct paper Fri 7–10 L."
        );
      }
      // Prefer evening over inventing daytime-only usual
      emp.dna.commonShiftTypes = emp.dna.commonShiftTypes.filter(
        (st) =>
          !(
            st.location === "lehigh" &&
            st.startMinutes === 12 * 60 &&
            (st.notes ?? "").includes("Usual Lehi daytime")
          )
      );
      if (
        !emp.dna.commonShiftTypes.some(
          (st) => st.location === "lehigh" && st.startMinutes >= 18 * 60
        )
      ) {
        emp.dna.commonShiftTypes.push({
          startMinutes: 19 * 60,
          endMinutes: 22 * 60,
          location: "lehigh",
          dayHints: ["friday"],
          weeksObserved: 1,
          notes: "Occasional Lehi evening — Oct Fri 7–10 L",
        });
      }
    }
  }

  // Oct 5–11 paper — pattern evidence only (separate from Sep 14–20 sign-off test)
  applyOct5PatternEvidence(employees);

  for (const emp of employees) {
    if ((emp.dna.commonShiftTypes?.length ?? 0) > 0) {
      emp.dna.enabled = true;
    }
  }
}
