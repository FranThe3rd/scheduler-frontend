import type { Employee } from "./types";
import { emptyEmployeeDna } from "./seed/emptyDna";
import { newId } from "./time";

const COLORS = [
  "#C8E6C9", "#BBDEFB", "#FFE0B2", "#F8BBD0", "#D1C4E9",
  "#B2DFDB", "#FFF9C4", "#FFCCBC", "#C5CAE9", "#DCEDC8",
];

export function initialsFor(displayName: string, printedLabel: string): string {
  const fromName = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
  if (fromName.length >= 2) return fromName;
  const fromLabel = printedLabel.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  return fromLabel || "??";
}

/** Build a new roster employee with the same defaults as seed data. */
export function createEmployee(args: {
  displayName: string;
  printedLabel?: string;
  colorIndex: number;
}): Employee {
  const displayName = args.displayName.trim();
  const printedLabel = (args.printedLabel ?? displayName).trim() || displayName;
  return {
    id: newId("emp"),
    displayName,
    printedLabel,
    firstNameConfirmed: false,
    lastNameConfirmed: false,
    aliases: [],
    color: COLORS[args.colorIndex % COLORS.length]!,
    initials: initialsFor(displayName, printedLabel),
    status: "active",
    autoScheduleEnabled: true,
    context: { notes: [], circumstances: [] },
    recurringAvailability: [],
    limits: [],
    qualifications: [],
    preferences: [],
    dna: emptyEmployeeDna(),
  };
}
