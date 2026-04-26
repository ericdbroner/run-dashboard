import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";

export function toDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateISO(dateISO: string): Date {
  const [yearText, monthText, dayText] = dateISO.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return new Date(year, month - 1, day);
}

export function normalizeDateISO(value: string): string {
  return toDateISO(parseDateISO(value));
}

export function todayISO(): string {
  return toDateISO(new Date());
}

export function monthISOFromDate(date: Date): string {
  return format(date, "yyyy-MM");
}

export function currentMonthISO(): string {
  return monthISOFromDate(new Date());
}

export function parseMonthISO(monthISO: string): Date {
  const [yearText, monthText] = monthISO.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return new Date(year, month - 1, 1);
}

export function nextMonthISO(monthISO: string): string {
  return monthISOFromDate(addMonths(parseMonthISO(monthISO), 1));
}

export function previousMonthISO(monthISO: string): string {
  return monthISOFromDate(addMonths(parseMonthISO(monthISO), -1));
}

export function monthRangeISO(monthISO: string): { startISO: string; endISO: string } {
  const start = startOfMonth(parseMonthISO(monthISO));
  const end = endOfMonth(start);
  return {
    startISO: toDateISO(start),
    endISO: toDateISO(end)
  };
}

export function labelForDateISO(dateISO: string): string {
  return format(parseDateISO(dateISO), "EEEE, MMM d, yyyy");
}
