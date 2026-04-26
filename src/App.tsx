import { useEffect, useMemo, useState } from "react";
import { DayDetailPanel } from "./components/DayDetailPanel";
import { MonthCalendar } from "./components/MonthCalendar";
import { currentMonthISO, monthRangeISO, todayISO } from "./lib/date";
import { createDexiePlannerRepository } from "./repository/DexiePlannerRepository";
import type { PlannerRepository } from "./repository/PlannerRepository";
import type {
  CreateWorkoutInput,
  PlannerPreferences,
  Template,
  UpdateWorkoutInput,
  Workout,
  WorkoutStatus
} from "./types/planner";

interface AppProps {
  repository?: PlannerRepository;
}

function defaultPreferences(): PlannerPreferences {
  return {
    weekStartsOn: "monday",
    lastViewedMonthISO: currentMonthISO()
  };
}

export default function App({ repository }: AppProps) {
  const plannerRepository = useMemo(
    () => repository ?? createDexiePlannerRepository(),
    [repository]
  );

  const [monthISO, setMonthISO] = useState(currentMonthISO());
  const [selectedDateISO, setSelectedDateISO] = useState(todayISO());
  const [templates, setTemplates] = useState<Template[]>([]);
  const [monthWorkouts, setMonthWorkouts] = useState<Workout[]>([]);
  const [dayWorkouts, setDayWorkouts] = useState<Workout[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [ready, setReady] = useState(false);

  async function refreshMonth(targetMonthISO: string): Promise<void> {
    const range = monthRangeISO(targetMonthISO);
    const workouts = await plannerRepository.listByDateRange(range.startISO, range.endISO);
    setMonthWorkouts(workouts);
  }

  async function refreshDay(targetDateISO: string): Promise<void> {
    const workouts = await plannerRepository.listByDay(targetDateISO);
    setDayWorkouts(workouts);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const [loadedTemplates, preferences] = await Promise.all([
          plannerRepository.listTemplates(),
          plannerRepository.getPreferences().catch(() => defaultPreferences())
        ]);

        if (!active) {
          return;
        }

        setTemplates(loadedTemplates);
        setMonthISO(preferences.lastViewedMonthISO);

        const range = monthRangeISO(preferences.lastViewedMonthISO);
        const [monthData, dayData] = await Promise.all([
          plannerRepository.listByDateRange(range.startISO, range.endISO),
          plannerRepository.listByDay(todayISO())
        ]);

        if (!active) {
          return;
        }

        setMonthWorkouts(monthData);
        setDayWorkouts(dayData);
        setReady(true);
      } catch (error) {
        if (!active) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "Failed to initialize planner.");
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [plannerRepository]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void plannerRepository.updatePreferences({ lastViewedMonthISO: monthISO });
    void refreshMonth(monthISO).catch((error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load month data.");
    });
  }, [monthISO, plannerRepository, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void refreshDay(selectedDateISO).catch((error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load day data.");
    });
  }, [plannerRepository, ready, selectedDateISO]);

  async function applyMutation(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
      await Promise.all([refreshMonth(monthISO), refreshDay(selectedDateISO)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Planner operation failed.");
    }
  }

  async function createWorkoutFromTemplate(input: CreateWorkoutInput): Promise<void> {
    await applyMutation(async () => {
      await plannerRepository.createWorkout(input);
    });
  }

  async function updateWorkout(id: string, patch: UpdateWorkoutInput): Promise<void> {
    await applyMutation(async () => {
      await plannerRepository.updateWorkout(id, patch);
    });
  }

  async function setWorkoutStatus(id: string, status: WorkoutStatus): Promise<void> {
    await applyMutation(async () => {
      await plannerRepository.setStatus(id, status);
    });
  }

  async function deleteWorkout(id: string): Promise<void> {
    await applyMutation(async () => {
      await plannerRepository.deleteWorkout(id);
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Run Planner Desktop</h1>
          <p>Local-only calendar planner for running workouts.</p>
        </div>
      </header>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <div className="layout-grid">
        <MonthCalendar
          monthISO={monthISO}
          selectedDateISO={selectedDateISO}
          workouts={monthWorkouts}
          onChangeMonth={setMonthISO}
          onSelectDate={setSelectedDateISO}
        />

        <DayDetailPanel
          dateISO={selectedDateISO}
          workouts={dayWorkouts}
          templates={templates}
          onCreateFromTemplate={createWorkoutFromTemplate}
          onUpdateWorkout={updateWorkout}
          onSetStatus={setWorkoutStatus}
          onDeleteWorkout={deleteWorkout}
        />
      </div>
    </main>
  );
}
