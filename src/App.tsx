import { useCallback, useEffect, useMemo, useState } from "react";
import { DayDetailPanel } from "./components/DayDetailPanel";
import { MonthCalendar } from "./components/MonthCalendar";
import { VdotManager } from "./components/VdotManager";
import { monthGridRangeISO, monthWeekStartISOs } from "./lib/calendar";
import { currentMonthISO, isDateISOInRange, todayISO } from "./lib/date";
import { buildWeekMetrics, resolveActiveVdotProfile } from "./lib/weeklyMetrics";
import { createDexiePlannerRepository } from "./repository/DexiePlannerRepository";
import type { PlannerRepository } from "./repository/PlannerRepository";
import type {
  CreateWorkoutInput,
  PlannerPreferences,
  UpdateWorkoutInput,
  VdotProfile,
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
  const plannerRepository = useMemo(() => repository ?? createDexiePlannerRepository(), [repository]);

  const [monthISO, setMonthISO] = useState(currentMonthISO());
  const [selectedDateISO, setSelectedDateISO] = useState(todayISO());
  const [monthVisibleWorkouts, setMonthVisibleWorkouts] = useState<Workout[]>([]);
  const [monthAnalysisWorkouts, setMonthAnalysisWorkouts] = useState<Workout[]>([]);
  const [dayWorkouts, setDayWorkouts] = useState<Workout[]>([]);
  const [vdotProfiles, setVdotProfiles] = useState<VdotProfile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [ready, setReady] = useState(false);

  const loadVdotProfiles = useCallback(async () => {
    const profiles = await plannerRepository.listVdotProfiles();
    setVdotProfiles(profiles);
  }, [plannerRepository]);

  const loadMonthWorkouts = useCallback(
    async (targetMonthISO: string) => {
      const range = monthGridRangeISO(targetMonthISO);
      const workouts = await plannerRepository.listByDateRange(range.analysisStartISO, range.analysisEndISO);

      setMonthAnalysisWorkouts(workouts);
      setMonthVisibleWorkouts(
        workouts.filter((workout) => isDateISOInRange(workout.dateISO, range.visibleStartISO, range.visibleEndISO))
      );
    },
    [plannerRepository]
  );

  const loadDayWorkouts = useCallback(
    async (targetDateISO: string) => {
      const workouts = await plannerRepository.listByDay(targetDateISO);
      setDayWorkouts(workouts);
    },
    [plannerRepository]
  );

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const preferences = await plannerRepository.getPreferences().catch(() => defaultPreferences());

        if (!active) {
          return;
        }

        setMonthISO(preferences.lastViewedMonthISO);
        await Promise.all([
          loadVdotProfiles(),
          loadMonthWorkouts(preferences.lastViewedMonthISO),
          loadDayWorkouts(selectedDateISO)
        ]);

        if (!active) {
          return;
        }

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
  }, [loadDayWorkouts, loadMonthWorkouts, loadVdotProfiles, plannerRepository, selectedDateISO]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void plannerRepository.updatePreferences({ lastViewedMonthISO: monthISO });
    void loadMonthWorkouts(monthISO).catch((error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load month data.");
    });
  }, [monthISO, plannerRepository, ready, loadMonthWorkouts]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void loadDayWorkouts(selectedDateISO).catch((error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load day data.");
    });
  }, [loadDayWorkouts, ready, selectedDateISO]);

  const activeVdot = useMemo(
    () => resolveActiveVdotProfile(vdotProfiles, selectedDateISO),
    [selectedDateISO, vdotProfiles]
  );

  const weekMetricsByStart = useMemo(() => {
    const starts = monthWeekStartISOs(monthISO);
    return Object.fromEntries(
      starts.map((startISO) => [startISO, buildWeekMetrics(startISO, monthAnalysisWorkouts, vdotProfiles)])
    );
  }, [monthAnalysisWorkouts, monthISO, vdotProfiles]);

  const resolveVdotForDate = useCallback(
    (dateISO: string) => resolveActiveVdotProfile(vdotProfiles, dateISO),
    [vdotProfiles]
  );

  async function applyWorkoutMutation(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
      await Promise.all([loadMonthWorkouts(monthISO), loadDayWorkouts(selectedDateISO)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Planner operation failed.");
    }
  }

  async function applyVdotMutation(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
      await Promise.all([loadVdotProfiles(), loadMonthWorkouts(monthISO), loadDayWorkouts(selectedDateISO)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "VDOT operation failed.");
    }
  }

  async function createWorkout(input: CreateWorkoutInput): Promise<void> {
    await applyWorkoutMutation(async () => {
      await plannerRepository.createWorkout(input);
    });
  }

  async function updateWorkout(id: string, patch: UpdateWorkoutInput): Promise<void> {
    await applyWorkoutMutation(async () => {
      await plannerRepository.updateWorkout(id, patch);
    });
  }

  async function setWorkoutStatus(id: string, status: WorkoutStatus): Promise<void> {
    await applyWorkoutMutation(async () => {
      await plannerRepository.setStatus(id, status);
    });
  }

  async function deleteWorkout(id: string): Promise<void> {
    await applyWorkoutMutation(async () => {
      await plannerRepository.deleteWorkout(id);
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Run Planner Desktop</h1>
          <p>VDOT-based planner with structured workout entry and weekly distribution analytics.</p>
        </div>
      </header>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <VdotManager
        profiles={vdotProfiles}
        onCreate={async (input) => {
          await applyVdotMutation(async () => {
            await plannerRepository.createVdotProfile(input);
          });
        }}
        onUpdate={async (id, patch) => {
          await applyVdotMutation(async () => {
            await plannerRepository.updateVdotProfile(id, patch);
          });
        }}
        onDelete={async (id) => {
          await applyVdotMutation(async () => {
            await plannerRepository.deleteVdotProfile(id);
          });
        }}
      />

      <div className="layout-grid">
        <MonthCalendar
          monthISO={monthISO}
          selectedDateISO={selectedDateISO}
          workouts={monthVisibleWorkouts}
          weekMetricsByStart={weekMetricsByStart}
          onChangeMonth={setMonthISO}
          onSelectDate={setSelectedDateISO}
        />

        <DayDetailPanel
          dateISO={selectedDateISO}
          workouts={dayWorkouts}
          activeVdot={activeVdot}
          resolveVdotForDate={resolveVdotForDate}
          onCreateWorkout={createWorkout}
          onUpdateWorkout={updateWorkout}
          onSetStatus={setWorkoutStatus}
          onDeleteWorkout={deleteWorkout}
        />
      </div>
    </main>
  );
}
