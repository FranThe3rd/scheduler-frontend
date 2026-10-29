/** Color for a shift cell: off, Lehigh, ice cream, or main store. */
export function chipStyle(text: string): string {
  if (text === "—" || text === "") return "bg-[#f4b7b8] text-[#8d3d45]";
  if (/\bL\b/.test(text)) return "bg-[#f3d56a] text-[#6d5310]";
  if (/IC/i.test(text)) return "bg-[#d7e4f8] text-[#2c4a73]";
  return "bg-[#b7d7a8] text-[#245033]";
}
