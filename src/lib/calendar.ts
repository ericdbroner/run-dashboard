import { addDays, format, startOfMonth, startOfWeek } from "date-fns";
import { monthISOFromDate, parseDateISO, parseMonthISO, toDateISO } from "./date";

export interface CalendarCell {
  dateISO: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
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
      inCurrentMonth: monthISOFromDate(date) == monthISO
    };
  });
}

export function weekdayLabels(): string[] {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => format(addDays(monday, index), "EEE"));
}

export function isDateInMonth(dateISO: string, monthISO: string): boolean {
  return monthISOFromDate(parseDateISO(dateISO)) == monthISO;
}
