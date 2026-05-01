import { currentMonthISO, normalizeDateISO } from "../lib/date";
import { MAX_VDOT, MIN_VDOT } from "../lib/vdotChart";
import { sortWorkoutsDeterministically } from "../lib/sort";
import { DEFAULT_TEMPLATES } from "../repository/defaultTemplates";
import type { PlannerRepository } from "../repository/PlannerRepository";
import type {
  CreateVdotProfileInput,
  CreateWorkoutInput,
  PlannerPreferences,
  Template,
  UpdateVdotProfileInput,
  UpdateWorkoutInput,
  VdotProfile,
  Workout,
  WorkoutStatus
} from "../types/planner";

function nowISO(): string {
  return new Date().toISOString();
}

function sanitizeWorkout(input: CreateWorkoutInput | UpdateWorkoutInput, fallbackMode: Workout["entryMode"] = "simpleRun") {
  const entryMode = input.entryMode ?? fallbackMode;
  if (entryMode === "simpleRun") {
    return {
      entryMode,
      simpleRun: {
        mileage: Math.max(0, input.simpleRun?.mileage ?? 0),
        zone: input.simpleRun?.zone ?? "EL",
        isLongRun: input.simpleRun?.isLongRun ?? false
      },
      workout: undefined,
      notes: input.notes?.trim() || undefined
    } as const;
  }

  return {
    entryMode,
    simpleRun: undefined,
    workout: {
      warmupDistanceMiles: Math.max(0, input.workout?.warmupDistanceMiles ?? 0),
      cooldownDistanceMiles: Math.max(0, input.workout?.cooldownDistanceMiles ?? 0),
      blocks: (input.workout?.blocks ?? []).map((block) => ({
        id: block.id,
        repDistanceMiles: Math.max(0, block.repDistanceMiles),
        repZone: block.repZone,
        recoveryMode: block.recoveryMode,
        recoveryDistanceMiles:
          block.recoveryMode === "distance" ? Math.max(0, block.recoveryDistanceMiles ?? 0) : undefined,
        recoveryDurationMinutes:
          block.recoveryMode === "time" ? Math.max(0, block.recoveryDurationMinutes ?? 0) : undefined,
        repeats: Math.max(1, Math.floor(block.repeats || 1))
      }))
    },
    notes: input.notes?.trim() || undefined
  } as const;
}

export class InMemoryPlannerRepository implements PlannerRepository {
  private workouts: Workout[] = [];
  private readonly templates: Template[];
  private preferences: PlannerPreferences;
  private vdotProfiles: VdotProfile[] = [];

  constructor() {
    this.templates = [...DEFAULT_TEMPLATES].sort((a, b) => a.label.localeCompare(b.label));
    this.preferences = {
      weekStartsOn: "monday",
      lastViewedMonthISO: currentMonthISO()
    };
  }

  async listByDateRange(startISO: string, endISO: string): Promise<Workout[]> {
    const normalizedStart = normalizeDateISO(startISO);
    const normalizedEnd = normalizeDateISO(endISO);

    return sortWorkoutsDeterministically(
      this.workouts.filter((workout) => workout.dateISO >= normalizedStart && workout.dateISO <= normalizedEnd)
    );
  }

  async listByDay(dateISO: string): Promise<Workout[]> {
    const normalized = normalizeDateISO(dateISO);
    return sortWorkoutsDeterministically(this.workouts.filter((workout) => workout.dateISO === normalized));
  }

  async createWorkout(input: CreateWorkoutInput): Promise<Workout> {
    const timestamp = nowISO();
    const details = sanitizeWorkout(input, input.entryMode);

    const workout: Workout = {
      id: crypto.randomUUID(),
      dateISO: normalizeDateISO(input.dateISO),
      title: input.title.trim(),
      status: input.status ?? "planned",
      createdAtISO: timestamp,
      updatedAtISO: timestamp,
      ...details
    };

    this.workouts.push(workout);
    return workout;
  }

  async updateWorkout(id: string, patch: UpdateWorkoutInput): Promise<Workout> {
    const index = this.workouts.findIndex((workout) => workout.id === id);
    if (index < 0) {
      throw new Error("Workout not found");
    }

    const existing = this.workouts[index];
    const details = sanitizeWorkout(
      {
        ...existing,
        ...patch,
        entryMode: patch.entryMode ?? existing.entryMode,
        simpleRun: patch.simpleRun ?? existing.simpleRun,
        workout: patch.workout ?? existing.workout
      },
      patch.entryMode ?? existing.entryMode
    );

    const updated: Workout = {
      ...existing,
      dateISO: patch.dateISO ? normalizeDateISO(patch.dateISO) : existing.dateISO,
      title: patch.title ? patch.title.trim() : existing.title,
      status: patch.status ?? existing.status,
      updatedAtISO: nowISO(),
      ...details
    };

    this.workouts[index] = updated;
    return updated;
  }

  async deleteWorkout(id: string): Promise<void> {
    this.workouts = this.workouts.filter((workout) => workout.id !== id);
  }

  async setStatus(id: string, status: WorkoutStatus): Promise<Workout> {
    const index = this.workouts.findIndex((workout) => workout.id === id);
    if (index < 0) {
      throw new Error("Workout not found");
    }

    const updated: Workout = {
      ...this.workouts[index],
      status,
      updatedAtISO: nowISO()
    };

    this.workouts[index] = updated;
    return updated;
  }

  async listTemplates(): Promise<Template[]> {
    return [...this.templates];
  }

  async listVdotProfiles(): Promise<VdotProfile[]> {
    return [...this.vdotProfiles].sort((a, b) => a.effectiveDateISO.localeCompare(b.effectiveDateISO));
  }

  async createVdotProfile(input: CreateVdotProfileInput): Promise<VdotProfile> {
    const profile: VdotProfile = {
      id: crypto.randomUUID(),
      effectiveDateISO: normalizeDateISO(input.effectiveDateISO),
      vdot: Math.max(MIN_VDOT, Math.min(MAX_VDOT, Math.round(input.vdot)))
    };

    this.vdotProfiles.push(profile);
    return profile;
  }

  async updateVdotProfile(id: string, patch: UpdateVdotProfileInput): Promise<VdotProfile> {
    const index = this.vdotProfiles.findIndex((profile) => profile.id === id);
    if (index < 0) {
      throw new Error("VDOT profile not found");
    }

    const existing = this.vdotProfiles[index];
    const updated: VdotProfile = {
      ...existing,
      effectiveDateISO: patch.effectiveDateISO ? normalizeDateISO(patch.effectiveDateISO) : existing.effectiveDateISO,
      vdot: patch.vdot === undefined ? existing.vdot : Math.max(MIN_VDOT, Math.min(MAX_VDOT, Math.round(patch.vdot)))
    };

    this.vdotProfiles[index] = updated;
    return updated;
  }

  async deleteVdotProfile(id: string): Promise<void> {
    this.vdotProfiles = this.vdotProfiles.filter((profile) => profile.id !== id);
  }

  async resolveActiveVdot(dateISO: string): Promise<VdotProfile | null> {
    const normalized = normalizeDateISO(dateISO);
    const eligible = this.vdotProfiles
      .filter((profile) => profile.effectiveDateISO <= normalized)
      .sort((left, right) => right.effectiveDateISO.localeCompare(left.effectiveDateISO));

    return eligible[0] ?? null;
  }

  async getPreferences(): Promise<PlannerPreferences> {
    return { ...this.preferences };
  }

  async updatePreferences(patch: Partial<PlannerPreferences>): Promise<PlannerPreferences> {
    this.preferences = {
      weekStartsOn: "monday",
      lastViewedMonthISO: patch.lastViewedMonthISO ?? this.preferences.lastViewedMonthISO
    };

    return { ...this.preferences };
  }
}
