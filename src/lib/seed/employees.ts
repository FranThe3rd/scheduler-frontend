import type {
  Employee,
  EmployeeDna,
  SharedRowPattern,
  AppSettings,
  RoleTarget,
  DayOfWeek,
} from "../types";
import { emptyEmployeeDna } from "./emptyDna";

export { buildDefaultStaffingTargets } from "../staffingTargets";

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/** Soft pastel colors — one per employee, stable */
const COLORS = [
  "#C8E6C9", "#BBDEFB", "#FFE0B2", "#F8BBD0", "#D1C4E9",
  "#B2DFDB", "#FFF9C4", "#FFCCBC", "#C5CAE9", "#DCEDC8",
  "#B3E5FC", "#F0F4C3", "#E1BEE7", "#FFECB3", "#A5D6A7",
  "#90CAF9", "#FFAB91", "#CE93D8", "#80CBC4", "#FFE082",
  "#AED581", "#81D4FA", "#F48FB1", "#B39DDB", "#80DEEA",
];

function hm(h: number, m = 0) {
  return h * 60 + m;
}

function dnaBase(
  partial: Partial<EmployeeDna> & Pick<EmployeeDna, "workload" | "commonShiftTypes" | "weekdayObservations">
): EmployeeDna {
  return {
    source:
      "Four-week sample summaries (Aug 24–Sep 20). Year requires confirmation. Approximate; faint/ambiguous entries excluded.",
    yearNeedsConfirmation: true,
    lehighEvidenceNotes: [],
    limitedEvidence: false,
    enabled: true,
    ...partial,
  };
}

export const SHARED_ROW_PATTERNS: SharedRowPattern[] = [
  {
    id: "shared_lexy_brooke",
    label: "Lexy/Brooke",
    relatedEmployeeIds: ["emp_lexi", "emp_brooke"],
    observations: [
      "Tuesday 7–10 PM, Thursday 7–10 PM, and Sunday 9 AM–1 PM appear in each of the four sampled weeks.",
      "Shared row totals 3 shifts and 10 hours per week — not 10 hours for each person.",
      "One Tuesday assignment carries L notation.",
      "One September 21–27 photo explicitly identifies Lexi for Saturday 6–10 PM.",
      "Preserve as unresolved evidence until Mike identifies the worker for each assignment.",
    ],
    sampleWeeks: 4,
    hoursPerWeekShared: 10,
    shiftsPerWeekShared: 3,
    unresolved: true,
  },
];

export function buildSeedEmployees(): Employee[] {
  const roster: Omit<Employee, "color" | "initials" | "recurringAvailability" | "limits" | "qualifications" | "preferences">[] = [
    {
      id: "emp_marietta_zweifel",
      displayName: "Marietta Zweifel",
      printedLabel: "M. Zweifel",
      firstName: "Marietta",
      lastName: "Zweifel",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [{ alias: "Marietta", confirmed: true }, { alias: "Zweifel", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "none",
        notes: ["Retired; commonly mornings/early afternoon."],
        circumstances: ["Retired"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4.8,
          approxHoursPerWeek: 17.3,
          hoursRange: "15–18",
          mainPattern: "Consistent weekday mornings/early afternoons",
          sampleWeeks: 4,
          uncertaintyNotes: ["Supporting week counts for seeded soft templates are unverified."],
        },
        commonShiftTypes: [
          { startMinutes: hm(9), endMinutes: hm(13), dayHints: ["monday", "wednesday", "friday"], weeksObserved: 4, notes: "Seeded soft observation; also matches confirmed recurring template seed." },
          { startMinutes: hm(12), endMinutes: hm(15), dayHints: ["tuesday", "thursday"], weeksObserved: 4 },
        ],
        weekdayObservations: [
          { day: "monday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(9), endMinutes: hm(13) }] },
          { day: "tuesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(12), endMinutes: hm(15) }] },
          { day: "wednesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(9), endMinutes: hm(13) }] },
          { day: "thursday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(12), endMinutes: hm(15) }] },
          { day: "friday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(9), endMinutes: hm(13) }] },
        ],
      }),
    },
    {
      id: "emp_makary",
      displayName: "F. Makary",
      printedLabel: "F. Makary",
      firstName: "F.",
      lastName: "Makary",
      firstNameConfirmed: false,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Makary", confirmed: true },
        { alias: "F. Makary", confirmed: true },
      ],
      status: "active",
      context: {
        schoolStatus: "unconfirmed",
        notes: ["First name needs confirmation."],
        circumstances: ["First name unknown"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 2.3,
          approxHoursPerWeek: 9,
          hoursRange: "0–20",
          mainPattern: "Variable Lehigh midday shifts",
          sampleWeeks: 4,
          uncertaintyNotes: ["Missing first name; variable hours require confirmation."],
        },
        commonShiftTypes: [
          { startMinutes: hm(12), endMinutes: hm(16), location: "lehigh", dayHints: ["friday", "tuesday", "wednesday"], weeksObserved: 4, notes: "All nine readable assignments noon–4 PM with L." },
        ],
        weekdayObservations: [
          { day: "friday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(12), endMinutes: hm(16) }] },
          { day: "tuesday", weeksObserved: 2, typicalWindows: [{ startMinutes: hm(12), endMinutes: hm(16) }] },
          { day: "wednesday", weeksObserved: 2, typicalWindows: [{ startMinutes: hm(12), endMinutes: hm(16) }] },
        ],
        lehighEvidenceNotes: ["All readable sampled assignments marked L."],
      }),
    },
    {
      id: "emp_clausnitzer",
      displayName: "B. Clausnitzer",
      printedLabel: "B. Clausnitzer",
      firstName: "B.",
      lastName: "Clausnitzer",
      firstNameConfirmed: false,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Clausnitzer", confirmed: true },
        { alias: "B. Clausnitzer", confirmed: true },
        { alias: "Klauschnitzer", confirmed: false },
      ],
      status: "active",
      context: {
        schoolStatus: "unconfirmed",
        notes: ["First name needs confirmation."],
        circumstances: ["First name unknown"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 1.3,
          approxHoursPerWeek: 5.8,
          hoursRange: "0–10 readable hours",
          mainPattern: "Occasional Lehigh midday shifts; unclear entry",
          sampleWeeks: 4,
          uncertaintyNotes: ["+ indicates unclear entries could increase figures.", "Do not interpret low average as desired workload."],
        },
        commonShiftTypes: [
          { startMinutes: hm(12), endMinutes: hm(16), location: "lehigh", dayHints: ["thursday", "tuesday", "wednesday"], notes: "noon–4 or noon–5, all L" },
          { startMinutes: hm(12), endMinutes: hm(17), location: "lehigh", dayHints: ["thursday"] },
        ],
        weekdayObservations: [
          { day: "thursday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(12), endMinutes: hm(16) }] },
        ],
        lehighEvidenceNotes: ["Readable assignments marked L."],
      }),
    },
    {
      id: "emp_jenn_stone",
      displayName: "Jenn Stone",
      printedLabel: "J. Stone",
      firstName: "Jenn",
      lastName: "Stone",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Jen", confirmed: true },
        { alias: "Jenn", confirmed: true },
        { alias: "Stone", confirmed: true },
        { alias: "Jennifer", confirmed: false },
      ],
      status: "active",
      context: {
        schoolStatus: "unconfirmed",
        notes: [
          "Display name is Jenn Stone. Jen remains an approved alias for the same person only.",
        ],
        circumstances: [],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4,
          approxHoursPerWeek: 16,
          hoursRange: "16 each week",
          mainPattern: "Very consistent 6–10 PM shifts",
          sampleWeeks: 4,
          uncertaintyNotes: ["Opening/closing qualifications still require Mike’s confirmation."],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["monday", "wednesday", "friday", "sunday"], weeksObserved: 4 },
        ],
        weekdayObservations: [
          { day: "monday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "wednesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "friday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "sunday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
      }),
    },
    {
      id: "emp_mike_wagner",
      displayName: "Mike Wagner",
      printedLabel: "M. Wagner",
      firstName: "Mike",
      lastName: "Wagner",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Mike", confirmed: true },
        { alias: "Wagner", confirmed: true },
        { alias: "Michael", confirmed: false },
      ],
      status: "active",
      autoScheduleEnabled: false,
      context: {
        schoolStatus: "none",
        notes: [
          "Manager who creates and approves schedules.",
          "Oversees scheduling and manually chooses IC assignments.",
          "autoScheduleEnabled=false — never auto-assign floor or IC; manual add/lock only.",
        ],
        circumstances: ["Manager"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 2,
          approxHoursPerWeek: 8,
          hoursRange: "8 timed floor hours each week",
          mainPattern: "Sunday evening floor historically; Saturday 9–1 disputed / disabled for auto-schedule",
          sampleWeeks: 4,
          uncertaintyNotes: [
            "IC duration unspecified in samples.",
            "Do not enforce Sunday evening as permanent.",
            "Manager correction: Saturday 9–1 is NOT an automatic candidate pending clarification of Mike’s current hours.",
            "Do not fill ordinary weekday openings with Mike because he is the manager.",
            "IC assignments remain manually entered only.",
          ],
        },
        commonShiftTypes: [
          {
            startMinutes: hm(9),
            endMinutes: hm(13),
            dayHints: ["saturday"],
            weeksObserved: 4,
            autoScheduleDisabled: true,
            notes: "Historical Saturday 9–1 — disabled for auto-schedule pending clarification.",
          },
          {
            startMinutes: hm(18),
            endMinutes: hm(22),
            dayHints: ["sunday"],
            weeksObserved: 4,
            notes: "Historical Sunday evening — soft only; do not treat as permanent.",
          },
        ],
        weekdayObservations: [
          { day: "saturday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(9), endMinutes: hm(13) }], notes: "Auto-schedule disabled" },
          { day: "sunday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
      }),
    },
    {
      id: "emp_josh_roman",
      displayName: "Jordan Roman",
      printedLabel: "J. Roman",
      firstName: "Jordan",
      lastName: "Roman",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Jordan", confirmed: true },
        { alias: "Jordan Roman", confirmed: true },
        { alias: "J. Roman", confirmed: true },
        { alias: "Roman", confirmed: true },
      ],
      status: "active",
      context: {
        schoolStatus: "unconfirmed",
        notes: [
          "Confirmed: calendar Jordan is the same person as historical J. Roman / Jordan Roman.",
          "In the Sep 14–20 test calendar, OCR “John” was a misreading of Jordan (manager-confirmed for that upload).",
        ],
        circumstances: [],
      },
      dna: dnaBase({
        workload: {
          sampleWeeks: 0,
          mainPattern: "Current scheduling pattern unknown",
          uncertaintyNotes: [
            "No readable assignments in the four-week sample.",
            "Do not automatically create a zero-hour preference.",
          ],
        },
        commonShiftTypes: [],
        weekdayObservations: [],
        limitedEvidence: true,
      }),
    },
    {
      id: "emp_brady_dosedlo",
      displayName: "Brady Dosedlo",
      printedLabel: "B. Dosedlo",
      firstName: "Brady",
      lastName: "Dosedlo",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [{ alias: "Brady Dosedlo", confirmed: true }, { alias: "Dosedlo", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "none",
        notes: ["Full time at Dairy Store.", "Full-time context does not establish a contractual 30-hour target."],
        circumstances: ["Full time at Dairy Store"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 5,
          approxHoursPerWeek: 30,
          hoursRange: "30 each week",
          mainPattern: "Extremely consistent Monday–Friday daytime pattern",
          sampleWeeks: 4,
          uncertaintyNotes: [],
        },
        commonShiftTypes: [
          { startMinutes: hm(12), endMinutes: hm(18), dayHints: ["monday", "wednesday"], weeksObserved: 4 },
          { startMinutes: hm(9), endMinutes: hm(15), dayHints: ["tuesday", "thursday"], weeksObserved: 4 },
          { startMinutes: hm(11), endMinutes: hm(17), dayHints: ["friday"], weeksObserved: 2 },
        ],
        weekdayObservations: [
          { day: "monday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(12), endMinutes: hm(18) }] },
          { day: "tuesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(9), endMinutes: hm(15) }] },
          { day: "wednesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(12), endMinutes: hm(18) }] },
          { day: "thursday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(9), endMinutes: hm(15) }] },
          { day: "friday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(11), endMinutes: hm(17) }] },
        ],
      }),
    },
    {
      id: "emp_lexi",
      displayName: "Lexi",
      printedLabel: "Lexy/Brooke",
      firstName: "Lexi",
      firstNameConfirmed: false,
      lastNameConfirmed: false,
      aliases: [
        { alias: "Lexi", confirmed: false },
        { alias: "Lexy", confirmed: false },
      ],
      status: "active",
      sharedHistoricalLabel: "Lexy/Brooke",
      context: {
        schoolStatus: "unconfirmed",
        notes: [
          "Separate employee from Brooke; surname/spelling unconfirmed.",
          "Also works part time as a nurse; nursing schedule unconfirmed.",
          "Individual historical averages cannot be separated from the shared Lexy/Brooke row.",
          "Do not give her all shared-row assignments.",
        ],
        circumstances: ["Part-time nurse (schedule unconfirmed)", "Shared historical label Lexy/Brooke"],
      },
      dna: dnaBase({
        workload: {
          sampleWeeks: 0,
          mainPattern: "Individual average unknown — shared row",
          uncertaintyNotes: [
            "Shared Lexy/Brooke row cannot establish individual totals.",
            "One Sep 21–27 photo identifies Lexi for Saturday 6–10 PM.",
          ],
        },
        commonShiftTypes: [],
        weekdayObservations: [],
        limitedEvidence: true,
      }),
    },
    {
      id: "emp_brooke",
      displayName: "Brooke",
      printedLabel: "Lexy/Brooke",
      firstName: "Brooke",
      firstNameConfirmed: true,
      lastNameConfirmed: false,
      aliases: [{ alias: "Brooke", confirmed: true }],
      status: "active",
      sharedHistoricalLabel: "Lexy/Brooke",
      context: {
        schoolStatus: "unconfirmed",
        notes: [
          "Separate employee from Lexi; surname unconfirmed.",
          "Do not infer availability from Lexi’s employment or assignments.",
        ],
        circumstances: ["Shared historical label Lexy/Brooke"],
      },
      dna: dnaBase({
        workload: {
          sampleWeeks: 0,
          mainPattern: "Individual average unknown — shared row",
          uncertaintyNotes: ["Shared Lexy/Brooke row cannot establish individual totals."],
        },
        commonShiftTypes: [],
        weekdayObservations: [],
        limitedEvidence: true,
      }),
    },
    {
      id: "emp_dante_smith",
      displayName: "Dante Smith",
      printedLabel: "D. Smith",
      firstName: "Dante",
      lastName: "Smith",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [{ alias: "Dante", confirmed: true }, { alias: "Smith", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "none",
        notes: [
          "Starting a teaching job soon. Start date and future availability unconfirmed.",
          "May have IC assignments.",
        ],
        circumstances: ["Starting teaching job soon (date unconfirmed)"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4.8,
          approxHoursPerWeek: 26,
          hoursRange: "23–32 floor hours",
          mainPattern: "Broad daytime/evening mix; Friday/Saturday recurring",
          sampleWeeks: 4,
          uncertaintyNotes: ["Plus any untimed IC.", "Historical flexibility must not be assumed after teaching start."],
        },
        commonShiftTypes: [
          { startMinutes: hm(12), endMinutes: hm(18), dayHints: ["friday", "saturday"], weeksObserved: 4 },
          { startMinutes: hm(13), endMinutes: hm(18), dayHints: ["friday", "saturday"] },
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["thursday", "sunday"] },
        ],
        weekdayObservations: [
          { day: "friday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(12), endMinutes: hm(18) }] },
          { day: "saturday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(12), endMinutes: hm(18) }] },
          { day: "thursday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "sunday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
      }),
    },
    {
      id: "emp_tom_deangelis",
      displayName: "Tom DeAngelis",
      printedLabel: "T. DeAngelis",
      firstName: "Tom",
      lastName: "DeAngelis",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Tom", confirmed: true },
        { alias: "Tommy", confirmed: true },
        { alias: "Thomas", confirmed: true },
        { alias: "T. DeAngelis", confirmed: true },
        { alias: "DeAngelis", confirmed: true },
      ],
      status: "active",
      context: {
        schoolStatus: "college",
        notes: ["College student; future class availability must be entered separately."],
        circumstances: ["College student"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 5,
          approxHoursPerWeek: 22,
          hoursRange: "18–27 readable hours",
          mainPattern: "Mix of afternoon shifts and 6–10 PM; faint entries",
          sampleWeeks: 4,
          uncertaintyNotes: ["+ / faint entries; readable estimate only."],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["thursday", "friday", "sunday"] },
          { startMinutes: hm(13), endMinutes: hm(18), dayHints: ["monday", "tuesday"] },
        ],
        weekdayObservations: [
          { day: "thursday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "friday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "sunday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "monday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(13), endMinutes: hm(18) }] },
          { day: "tuesday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(13), endMinutes: hm(18) }] },
        ],
        lehighEvidenceNotes: ["Some assignments explicitly marked L."],
      }),
    },
    {
      id: "emp_brady_dologite",
      displayName: "Brady Dologite",
      printedLabel: "B. Dologite",
      firstName: "Brady",
      lastName: "Dologite",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Brady Dologite", confirmed: true },
        { alias: "Dologite", confirmed: true },
        // Common OCR misreads of this handwriting (not Brady Dosedlo)
        { alias: "Ologite", confirmed: false },
        { alias: "Ollogite", confirmed: false },
        { alias: "Brody Ologite", confirmed: false },
        { alias: "Brady Ologite", confirmed: false },
        { alias: "Brody Dologite", confirmed: false },
        { alias: "B. Ologite", confirmed: false },
        { alias: "B Ologite", confirmed: false },
        { alias: "B. Ollogite", confirmed: false },
      ],
      status: "active",
      context: {
        schoolStatus: "high_school",
        notes: [
          "High school student.",
          "Historical daytime shifts do not prove school-day availability.",
          "Do not infer dismissal times.",
          "OCR variants Ologite / Ollogite map here; stored surname Dologite unchanged pending verification.",
        ],
        circumstances: ["High school"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4.5,
          approxHoursPerWeek: 24.3,
          hoursRange: "21–28",
          mainPattern: "Lehigh; Wednesday/Friday/weekend recurring",
          sampleWeeks: 4,
          uncertaintyNotes: [],
        },
        commonShiftTypes: [
          { startMinutes: hm(16), endMinutes: hm(22), location: "lehigh", dayHints: ["wednesday", "friday"] },
          { startMinutes: hm(13), endMinutes: hm(18), location: "lehigh", dayHints: ["sunday"] },
        ],
        weekdayObservations: [
          { day: "wednesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(16), endMinutes: hm(22) }] },
          { day: "friday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(16), endMinutes: hm(22) }] },
          { day: "saturday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(13), endMinutes: hm(18) }] },
          { day: "sunday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(13), endMinutes: hm(18) }] },
        ],
        lehighEvidenceNotes: ["Every readable assignment marked L."],
      }),
    },
    {
      id: "emp_marques_enriquez",
      displayName: "Marques Enriquez",
      printedLabel: "M. Enriquez",
      firstName: "Marques",
      lastName: "Enriquez",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Marques", confirmed: true },
        { alias: "Enriquez", confirmed: true },
        { alias: "Marquez", confirmed: true },
      ],
      status: "active",
      context: {
        schoolStatus: "unconfirmed",
        notes: [
          "Prefers approximately 3–4 workdays weekly.",
          "Plans to leave soon for FM Systems; no confirmed departure date.",
          "Until final working date is confirmed, keep active with 3–4 day preference.",
          "Manager confirmation: does NOT work 9 AM–1 PM opening shifts.",
          "Usual shifts primarily 1–6 PM and 3–6 PM, with occasional evenings.",
        ],
        circumstances: [
          "Prefers ~3–4 workdays/week",
          "Plans to leave for FM Systems (date unconfirmed)",
          "Does not work 9–1 openings",
        ],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 3.9,
          approxHoursPerWeek: 14.5,
          hoursRange: "Roughly 10–20",
          mainPattern: "Afternoon-heavy (1–6 / 3–6); not morning openings",
          sampleWeeks: 4,
          uncertaintyNotes: [
            "History varies from almost every day to only 1–2 days.",
            "Preference of 3–4 workdays overrides treating a six-day historical week as desirable.",
            "Never auto-schedule 9–1 for Marques.",
            "Do not place overlapping 1–6 and 3–6 on the same day — one contiguous shift only.",
          ],
        },
        commonShiftTypes: [
          {
            startMinutes: hm(13),
            endMinutes: hm(18),
            dayHints: ["tuesday", "thursday", "wednesday"],
            weeksObserved: 4,
            notes: "Primary usual shift 1–6 PM",
          },
          {
            startMinutes: hm(15),
            endMinutes: hm(18),
            dayHints: ["tuesday", "thursday"],
            weeksObserved: 4,
            notes: "Alternate usual shift 3–6 PM — not combined with 1–6 same day",
          },
          {
            startMinutes: hm(18),
            endMinutes: hm(22),
            dayHints: ["tuesday", "thursday", "wednesday"],
            weeksObserved: 2,
            notes: "Occasional evening 6–10 PM",
          },
          {
            startMinutes: hm(19),
            endMinutes: hm(22),
            dayHints: ["tuesday", "thursday"],
            weeksObserved: 1,
            notes: "Occasional evening 7–10 PM",
          },
        ],
        weekdayObservations: [
          { day: "tuesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(15), endMinutes: hm(18) }, { startMinutes: hm(13), endMinutes: hm(18) }] },
          { day: "thursday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(15), endMinutes: hm(18) }, { startMinutes: hm(13), endMinutes: hm(18) }] },
          { day: "wednesday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(13), endMinutes: hm(18) }] },
        ],
      }),
    },
    {
      id: "emp_lucas_cramer",
      displayName: "Lucas Cramer",
      printedLabel: "L. Cramer",
      firstName: "Lucas",
      lastName: "Cramer",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [{ alias: "Lucas", confirmed: true }, { alias: "Cramer", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "high_school",
        notes: ["High school student.", "Do not infer school dismissal times."],
        circumstances: ["High school"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4.8,
          approxHoursPerWeek: 20,
          hoursRange: "15–23",
          mainPattern: "Afternoon and evening mix",
          sampleWeeks: 4,
          uncertaintyNotes: [],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["monday", "wednesday", "saturday"] },
          { startMinutes: hm(13), endMinutes: hm(18), dayHints: ["tuesday"] },
        ],
        weekdayObservations: [
          { day: "monday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "wednesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "saturday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "tuesday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(13), endMinutes: hm(18) }] },
        ],
        lehighEvidenceNotes: ["One 4–7 PM assignment explicitly marked L."],
      }),
    },
    {
      id: "emp_braelyn_roth",
      displayName: "Braelyn Roth",
      printedLabel: "B. Roth",
      firstName: "Braelyn",
      lastName: "Roth",
      firstNameConfirmed: false,
      lastNameConfirmed: true,
      aliases: [{ alias: "Braelyn", confirmed: false }, { alias: "Roth", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "college",
        notes: ["College student; first-name spelling tentative."],
        circumstances: ["College student"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 2.5,
          approxHoursPerWeek: 10.8,
          hoursRange: "8–13",
          mainPattern: "Friday and weekend emphasis",
          sampleWeeks: 4,
          uncertaintyNotes: [],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["friday"] },
          { startMinutes: hm(13), endMinutes: hm(18), dayHints: ["sunday", "saturday"] },
        ],
        weekdayObservations: [
          { day: "friday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "sunday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(13), endMinutes: hm(18) }] },
          { day: "saturday", weeksObserved: 2, typicalWindows: [{ startMinutes: hm(13), endMinutes: hm(18) }] },
        ],
      }),
    },
    {
      id: "emp_addy_giesler",
      displayName: "Addison Giesler",
      printedLabel: "A. Giesler",
      firstName: "Addison",
      lastName: "Giesler",
      firstNameConfirmed: false,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Addison", confirmed: true },
        { alias: "Addi", confirmed: true },
        { alias: "Addy", confirmed: true },
        { alias: "Giesler", confirmed: true },
      ],
      status: "active",
      context: {
        schoolStatus: "unconfirmed",
        notes: [
          "First-name spellings Addison / Addi / Addy linked to the same employee; school status unconfirmed.",
        ],
        circumstances: [],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 3,
          approxHoursPerWeek: 12,
          hoursRange: "8–16",
          mainPattern: "Consistent 6–10 PM shift type",
          sampleWeeks: 4,
          uncertaintyNotes: [],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["tuesday", "thursday", "saturday"], weeksObserved: 3 },
        ],
        weekdayObservations: [
          { day: "tuesday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "thursday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "saturday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
      }),
    },
    {
      id: "emp_alex_cheatham",
      displayName: "Alex Cheatham",
      printedLabel: "A. Cheatham",
      firstName: "Alex",
      lastName: "Cheatham",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [{ alias: "Alex", confirmed: true }, { alias: "Cheatham", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "high_school",
        notes: ["High school student.", "Do not treat observed daytime shifts as current school-day availability."],
        circumstances: ["High school"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4.5,
          approxHoursPerWeek: 19,
          hoursRange: "15–22",
          mainPattern: "Monday–Wednesday recurring; mainly evenings",
          sampleWeeks: 4,
          uncertaintyNotes: [],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["monday", "tuesday", "wednesday"], weeksObserved: 4 },
        ],
        weekdayObservations: [
          { day: "monday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "tuesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "wednesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
        lehighEvidenceNotes: ["Occasional explicit L assignments."],
      }),
    },
    {
      id: "emp_naliyah_bennick",
      displayName: "Naliyah Bennick",
      printedLabel: "N. Bennick",
      firstName: "Naliyah",
      lastName: "Bennick",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Naliyah", confirmed: true },
        { alias: "Nalia", confirmed: true },
        { alias: "Bennick", confirmed: true },
      ],
      status: "active",
      context: {
        schoolStatus: "college",
        notes: ["College student (not high school).", "Nalia is a spoken variant.", "Evening history does not establish college timetable."],
        circumstances: ["College student"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4.5,
          approxHoursPerWeek: 17.8,
          hoursRange: "14–20",
          mainPattern: "Mainly 6–10 PM and 7–10 PM",
          sampleWeeks: 4,
          uncertaintyNotes: [],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["monday", "wednesday", "saturday", "sunday"] },
          { startMinutes: hm(19), endMinutes: hm(22), dayHints: ["monday", "wednesday"] },
        ],
        weekdayObservations: [
          { day: "monday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "wednesday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "saturday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "sunday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
        lehighEvidenceNotes: ["Occasional explicit L assignments."],
      }),
    },
    {
      id: "emp_calvin_rittle",
      displayName: "Calvin Rittle",
      printedLabel: "C. Rittle",
      firstName: "Calvin",
      lastName: "Rittle",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [{ alias: "Calvin", confirmed: true }, { alias: "Rittle", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "high_school",
        notes: ["High school student."],
        circumstances: ["High school"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4,
          approxHoursPerWeek: 16.3,
          hoursRange: "12–21 readable hours",
          mainPattern: "Mainly 6–10 PM; substantial Lehigh history",
          sampleWeeks: 4,
          uncertaintyNotes: ["+ / faint entry excluded."],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", dayHints: ["monday", "wednesday"], weeksObserved: 3 },
        ],
        weekdayObservations: [
          { day: "monday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "wednesday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
        lehighEvidenceNotes: ["Twelve of sixteen clear assignments explicitly marked L.", "Strong Lehigh/evening tendency, not a permanent location restriction."],
      }),
    },
    {
      id: "emp_noah_miller",
      displayName: "Noah Miller",
      printedLabel: "N. Miller",
      firstName: "Noah",
      lastName: "Miller",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [{ alias: "Noah", confirmed: true }, { alias: "Miller", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "high_school",
        notes: ["High school student."],
        circumstances: ["High school"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4.8,
          approxHoursPerWeek: 19.3,
          hoursRange: "17–21 readable hours",
          mainPattern: "Evening-heavy; substantial Lehigh history",
          sampleWeeks: 4,
          uncertaintyNotes: ["+ / faint entry excluded."],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), location: "lehigh", dayHints: ["tuesday", "saturday"] },
        ],
        weekdayObservations: [
          { day: "tuesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "saturday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "monday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "thursday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "sunday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
        lehighEvidenceNotes: ["Twelve of nineteen clear assignments explicitly marked L."],
      }),
    },
    {
      id: "emp_kourtney_cantrel",
      displayName: "Kourtney",
      printedLabel: "Kourtney",
      firstName: "Kourtney",
      lastName: undefined,
      firstNameConfirmed: true,
      lastNameConfirmed: false,
      aliases: [
        { alias: "Courtney", confirmed: true },
        { alias: "Kourtney", confirmed: true },
      ],
      status: "active",
      context: {
        schoolStatus: "college",
        notes: [
          "College student.",
          "Kourtney’s surname remains unconfirmed; display as Kourtney C. only — do not invent a full surname.",
        ],
        circumstances: ["College student"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 3.8,
          approxHoursPerWeek: 14.3,
          hoursRange: "12–15 readable hours",
          mainPattern: "Evening weekdays and afternoon weekends",
          sampleWeeks: 4,
          uncertaintyNotes: ["+ / faint entry excluded."],
        },
        commonShiftTypes: [
          { startMinutes: hm(19), endMinutes: hm(22), dayHints: ["tuesday", "friday"] },
          { startMinutes: hm(13), endMinutes: hm(18), dayHints: ["saturday"] },
        ],
        weekdayObservations: [
          { day: "tuesday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(19), endMinutes: hm(22) }] },
          { day: "friday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(19), endMinutes: hm(22) }] },
          { day: "saturday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(13), endMinutes: hm(18) }] },
        ],
      }),
    },
    {
      id: "emp_alexis_horvath",
      displayName: "Alexis Horvath",
      printedLabel: "A. Horvath",
      firstName: "Alexis",
      lastName: "Horvath",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [{ alias: "Alexis", confirmed: true }, { alias: "Horvath", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "high_school",
        notes: ["High school student."],
        circumstances: ["High school"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 3.8,
          approxHoursPerWeek: 15,
          hoursRange: "12–18",
          mainPattern: "Strong weekend pattern; evening/afternoon mix",
          sampleWeeks: 4,
          uncertaintyNotes: [],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["saturday", "sunday"] },
        ],
        weekdayObservations: [
          { day: "saturday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "sunday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "thursday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
        lehighEvidenceNotes: ["Six of fifteen clear assignments explicitly marked L."],
      }),
    },
    {
      id: "emp_tyson_langensiepen",
      displayName: "Tyson Langensiepen",
      printedLabel: "T. Langensiepen",
      firstName: "Tyson",
      lastName: "Langensiepen",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [{ alias: "Tyson", confirmed: true }, { alias: "Langensiepen", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "high_school",
        notes: ["High school student."],
        circumstances: ["High school"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4.8,
          approxHoursPerWeek: 16.8,
          hoursRange: "15–18 readable hours",
          mainPattern: "Mainly 3–4-hour evening shifts",
          sampleWeeks: 4,
          uncertaintyNotes: ["+ / faint entry excluded."],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["monday", "tuesday", "wednesday", "saturday"] },
          { startMinutes: hm(19), endMinutes: hm(22), dayHints: ["monday"] },
        ],
        weekdayObservations: [
          { day: "monday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "tuesday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "wednesday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "saturday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
        lehighEvidenceNotes: ["One explicit L assignment."],
      }),
    },
    {
      id: "emp_aja_saez",
      displayName: "Aja Saez",
      printedLabel: "A. Saez",
      firstName: "Aja",
      lastName: "Saez",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [
        { alias: "Aja", confirmed: true },
        { alias: "Saez", confirmed: true },
        { alias: "Asia", confirmed: false },
      ],
      status: "active",
      context: {
        schoolStatus: "high_school",
        notes: [
          "New hire; high school.",
          "Aja is Aja, not Asia.",
          "Limited scheduling history.",
          "Sample suggests evening experience; does not establish a desired five-day workload.",
        ],
        circumstances: ["New hire", "High school", "Limited history"],
      },
      dna: dnaBase({
        workload: {
          approxWorkdaysPerWeek: 4.8,
          approxHoursPerWeek: 17,
          hoursRange: "14–19 readable hours",
          mainPattern: "Mostly evenings; limited tenure",
          sampleWeeks: 4,
          uncertaintyNotes: ["+ / several faint entries excluded.", "Limited evidence — allow manager-entered preferences."],
        },
        commonShiftTypes: [
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["wednesday", "monday", "friday"] },
        ],
        weekdayObservations: [
          { day: "wednesday", weeksObserved: 4, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "monday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "friday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "saturday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
          { day: "sunday", weeksObserved: 3, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }] },
        ],
        lehighEvidenceNotes: ["Explicit L assignments occur, including Sundays."],
        limitedEvidence: true,
      }),
    },
    {
      id: "emp_emily_braido",
      displayName: "Emily Braido",
      printedLabel: "E. Braido",
      firstName: "Emily",
      lastName: "Braido",
      firstNameConfirmed: true,
      lastNameConfirmed: true,
      aliases: [{ alias: "Emily", confirmed: true }, { alias: "Braido", confirmed: true }],
      status: "active",
      context: {
        schoolStatus: "high_school",
        notes: [
          "Newest hire; high school.",
          "Limited scheduling history.",
          "One later sample: 2 shifts, 7 hours — do not turn into permanent preference.",
        ],
        circumstances: ["Newest hire", "High school", "Limited history"],
      },
      dna: dnaBase({
        workload: {
          sampleWeeks: 1,
          approxWorkdaysPerWeek: 2,
          approxHoursPerWeek: 7,
          hoursRange: "One later sample: 2 shifts, 7 hours",
          mainPattern: "Too little history for a stable pattern",
          uncertaintyNotes: [
            "Appears as handwritten addition in one September 21–27 version.",
            "No reliable multiweek average.",
            "Do not turn one sample into a permanent Friday/Sunday rule.",
          ],
        },
        commonShiftTypes: [
          { startMinutes: hm(19), endMinutes: hm(22), dayHints: ["friday"], weeksObserved: 1, notes: "Single-sample only" },
          { startMinutes: hm(18), endMinutes: hm(22), dayHints: ["sunday"], weeksObserved: 1, notes: "Single-sample only" },
        ],
        weekdayObservations: [
          { day: "friday", weeksObserved: 1, typicalWindows: [{ startMinutes: hm(19), endMinutes: hm(22) }], notes: "Single sample" },
          { day: "sunday", weeksObserved: 1, typicalWindows: [{ startMinutes: hm(18), endMinutes: hm(22) }], notes: "Single sample" },
        ],
        limitedEvidence: true,
      }),
    },
  ];

  return roster.map((e, i) => {
    const initials = e.displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0]!.toUpperCase())
      .slice(0, 2)
      .join("");

    return {
      ...e,
      color: COLORS[i % COLORS.length]!,
      initials: initials.length >= 2 ? initials : (e.printedLabel.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "??"),
      dna: emptyEmployeeDna(),
      recurringAvailability: [],
      limits: [],
      qualifications: [],
      preferences: [],
    } satisfies Employee;
  });
}

export function buildDefaultRoleTargets(): RoleTarget[] {
  return [];
}

export function buildDefaultSettings(): AppSettings {
  return {
    locationConventionConfirmed: false,
    unmarkedMeansLinden: null,
    timezone: "America/New_York",
    staffingTargetsNeedConfirmation: true,
    openingClosingNeedConfirmation: true,
    baselineApprovedAt: null,
    ocrConfigured: false,
  };
}
