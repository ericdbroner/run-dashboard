import { addDays, format, startOfMonth, startOfWeek } from "date-fns";
import { addDaysISO, monthISOFromDate, parseDateISO, parseMonthISO, toDateISO } from "./date";

export interface CalendarCell {
  dateISO: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
}

export interface MonthGridRange {
  visibleStartISO: string;
  visibleEndISO: string;
  analysisStartISO: string;
  analysisEndISO: string;
}

export function buildMonthGrid(monthISO: string): CalendarCell[] {
  const monthStart = startOfMonth(parseMonthISO(monthISO));
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const dateISO = toDateISO(date);

    return {
      dateISO,
      dayOfMonth: date.getDate(),
      inCurrentMonth: monthISOFromDate(date) === monthISO
    };
  });
}

export function monthGridRows(monthISO: string): CalendarCell[][] {
  const cells = buildMonthGrid(monthISO);
  return Array.from({ length: 6 }, (_, rowIndex) => cells.slice(rowIndex * 7, rowIndex * 7 + 7));
}

export function monthWeekStartISOs(monthISO: string): string[] {
  return monthGridRows(monthISO).map((row) => row[0]?.dateISO ?? "").filter(Boolean);
}

export function monthGridRangeISO(monthISO: string): MonthGridRange {
  const rows = monthGridRows(monthISO);
  const visibleStartISO = rows[0]?.[0]?.dateISO ?? toDateISO(new Date());
  const visibleEndISO = rows[5]?.[6]?.dateISO ?? visibleStartISO;

  return {
    visibleStartISO,
    visibleEndISO,
    analysisStartISO: addDaysISO(visibleStartISO, -7),
    analysisEndISO: visibleEndISO
  };
}

export function weekdayLabels(): string[] {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => format(addDays(monday, index), "EEE"));
}

export function isDateInMonth(dateISO: string, monthISO: string): boolean {
  return monthISOFromDate(parseDateISO(dateISO)) === monthISO;
}
