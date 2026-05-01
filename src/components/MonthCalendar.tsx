import { format } from "date-fns";
import { isDateInMonth, monthGridRows, weekdayLabels } from "../lib/calendar";
import { monthISOFromDate, nextMonthISO, parseDateISO, previousMonthISO } from "../lib/date";
import type { WeekMetrics } from "../lib/weeklyMetrics";
import type { Workout } from "../types/planner";

interface MonthCalendarProps {
  monthISO: string;
  selectedDateISO: string;
  workouts: Workout[];
  weekMetricsByStart: Record<string, WeekMetrics>;
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

function formatPct(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `${value.toFixed(1)}%`;
}

export function MonthCalendar({
  monthISO,
  selectedDateISO,
  workouts,
  weekMetricsByStart,
  onChangeMonth,
  onSelectDate
}: MonthCalendarProps) {
  const rows = monthGridRows(monthISO);
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

      <div className="calendar-row-headings">
        <div className="weekday-row">
          {labels.map((label) => (
            <div key={label} className="weekday-cell">
              {label}
            </div>
          ))}
        </div>
        <div className="week-summary-heading">Week Summary</div>
      </div>

      <div className="month-rows">
        {rows.map((row) => {
          const weekStartISO = row[0]?.dateISO;
          const metrics = weekStartISO ? weekMetricsByStart[weekStartISO] : undefined;

          return (
            <div className="month-row" key={weekStartISO}>
              <div className="week-grid">
                {row.map((cell) => {
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

              <aside className="week-summary-card">
                <p>
                  <strong>Total:</strong> {metrics ? `${metrics.totalMileage.toFixed(1)} mi` : "0.0 mi"}
                </p>
                <p>
                  <strong>WoW:</strong> {metrics ? formatPct(metrics.percentChangeFromPrevious) : "—"}
                </p>
                <p>
                  <strong>E/L:</strong> {metrics ? formatPct(metrics.zonePercentages.EL) : "0.0%"}
                </p>
                <p>
                  <strong>M:</strong> {metrics ? formatPct(metrics.zonePercentages.M) : "0.0%"}
                </p>
                <p>
                  <strong>T:</strong> {metrics ? formatPct(metrics.zonePercentages.T) : "0.0%"}
                </p>
                <p>
                  <strong>I:</strong> {metrics ? formatPct(metrics.zonePercentages.I) : "0.0%"}
                </p>
                <p>
                  <strong>R:</strong> {metrics ? formatPct(metrics.zonePercentages.R) : "0.0%"}
                </p>
                <p>
                  <strong>Longest:</strong> {metrics ? formatPct(metrics.longestRunPercent) : "0.0%"}
                </p>
              </aside>
            </div>
          );
        })}
      </div>
    </section>
  );
}
