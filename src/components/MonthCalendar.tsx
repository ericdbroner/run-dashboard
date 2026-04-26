import { format } from "date-fns";
import { buildMonthGrid, isDateInMonth, weekdayLabels } from "../lib/calendar";
import { monthISOFromDate, nextMonthISO, parseDateISO, previousMonthISO } from "../lib/date";
import type { Workout } from "../types/planner";

interface MonthCalendarProps {
  monthISO: string;
  selectedDateISO: string;
  workouts: Workout[];
  onChangeMonth: (monthISO: string) => void;
  onSelectDate: (dateISO: string) => void;
}

function buildCountMap(workouts: Workout[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const workout of workouts) {
    counts.set(workout.dateISO, (counts.get(workout.dateISO) ?? 0) + 1);
  }

  return counts;
}

export function MonthCalendar({
  monthISO,
  selectedDateISO,
  workouts,
  onChangeMonth,
  onSelectDate
}: MonthCalendarProps) {
  const cells = buildMonthGrid(monthISO);
  const labels = weekdayLabels();
  const countMap = buildCountMap(workouts);
  const title = format(parseDateISO(`${monthISO}-01`), "MMMM yyyy");

  return (
    <section className="calendar-pane" aria-label="Calendar pane">
      <header className="calendar-header">
        <button type="button" onClick={() => onChangeMonth(previousMonthISO(monthISO))}>
          Prev
        </button>
        <h1>{title}</h1>
        <button type="button" onClick={() => onChangeMonth(nextMonthISO(monthISO))}>
          Next
        </button>
      </header>

      <div className="weekday-row">
        {labels.map((label) => (
          <div key={label} className="weekday-cell">
            {label}
          </div>
        ))}
      </div>

      <div className="month-grid">
        {cells.map((cell) => {
          const isSelected = selectedDateISO === cell.dateISO;
          const count = countMap.get(cell.dateISO) ?? 0;

          return (
            <button
              key={cell.dateISO}
              type="button"
              data-testid={`day-cell-${cell.dateISO}`}
              className={`day-cell${isSelected ? " selected" : ""}${cell.inCurrentMonth ? "" : " outside"}`}
              onClick={() => {
                onSelectDate(cell.dateISO);
                if (!isDateInMonth(cell.dateISO, monthISO)) {
                  onChangeMonth(monthISOFromDate(parseDateISO(cell.dateISO)));
                }
              }}
            >
              <span className="day-number">{cell.dayOfMonth}</span>
              {count > 0 ? (
                <span className="day-count" data-testid={`day-count-${cell.dateISO}`}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
