import { currentMonthISO, normalizeDateISO } from "../lib/date";
import { sortWorkoutsDeterministically } from "../lib/sort";
import { DEFAULT_TEMPLATES } from "../repository/defaultTemplates";
import type { PlannerRepository } from "../repository/PlannerRepository";
import type {
  CreateWorkoutInput,
  PlannerPreferences,
  Template,
  UpdateWorkoutInput,
  Workout,
  WorkoutStatus
} from "../types/planner";

function nowISO(): string {
  return new Date().toISOString();
}

function toOptionalNumber(value: number | undefined): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function toOptionalText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class InMemoryPlannerRepository implements PlannerRepository {
  private workouts: Workout[] = [];
  private readonly templates: Template[];
  private preferences: PlannerPreferences;

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
    const workout: Workout = {
      id: crypto.randomUUID(),
      dateISO: normalizeDateISO(input.dateISO),
      title: input.title.trim(),
      type: input.type,
      status: input.status ?? "planned",
      distanceMiles: toOptionalNumber(input.distanceMiles),
      durationMinutes: toOptionalNumber(input.durationMinutes),
      notes: toOptionalText(input.notes),
      createdAtISO: timestamp,
      updatedAtISO: timestamp
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
    const updated: Workout = {
      ...existing,
      dateISO: patch.dateISO ? normalizeDateISO(patch.dateISO) : existing.dateISO,
      title: patch.title ? patch.title.trim() : existing.title,
      type: patch.type ?? existing.type,
      distanceMiles: patch.distanceMiles === undefined ? existing.distanceMiles : toOptionalNumber(patch.distanceMiles),
      durationMinutes:
        patch.durationMinutes === undefined ? existing.durationMinutes : toOptionalNumber(patch.durationMinutes),
      notes: patch.notes === undefined ? existing.notes : toOptionalText(patch.notes),
      updatedAtISO: nowISO()
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
