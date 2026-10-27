const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "long" });

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Full selected month for the given 0-based relative offset (0 = current). */
export function getMonthWindow(monthOffset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

  return {
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    range: `${fmtDay(start)} – ${fmtDay(end)}`,
    monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    startISO: toISO(start),
    endISO: toISO(end),
  };
}

/** "2026-08-15" -> "2026-08". */
export const monthKeyOf = (isoDate: string) => isoDate.slice(0, 7);