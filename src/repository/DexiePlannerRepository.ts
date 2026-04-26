import Dexie, { type Table } from "dexie";
import { currentMonthISO, normalizeDateISO } from "../lib/date";
import { sortWorkoutsDeterministically } from "../lib/sort";
import type {
  CreateWorkoutInput,
  PlannerPreferences,
  Template,
  UpdateWorkoutInput,
  Workout,
  WorkoutStatus
} from "../types/planner";
import { DEFAULT_TEMPLATES } from "./defaultTemplates";
import type { PlannerRepository } from "./PlannerRepository";

interface StoredPreferences extends PlannerPreferences {
  id: "default";
}

class PlannerDexieDatabase extends Dexie {
  workouts!: Table<Workout, string>;
  templates!: Table<Template, string>;
  preferences!: Table<StoredPreferences, string>;

  constructor(name: string) {
    super(name);

    this.version(1).stores({
      workouts: "id, dateISO, status, [dateISO+status], updatedAtISO",
      templates: "id, label, type",
      preferences: "id"
    });
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

function maybeNumber(value: number | undefined): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }

  return value > 0 ? value : undefined;
}

function sanitizedText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildWorkoutRecord(input: CreateWorkoutInput): Workout {
  const timestamp = nowISO();

  return {
    id: crypto.randomUUID(),
    dateISO: normalizeDateISO(input.dateISO),
    title: input.title.trim(),
    type: input.type,
    status: input.status ?? "planned",
    distanceMiles: maybeNumber(input.distanceMiles),
    durationMinutes: maybeNumber(input.durationMinutes),
    notes: sanitizedText(input.notes),
    createdAtISO: timestamp,
    updatedAtISO: timestamp
  };
}

export class DexiePlannerRepository implements PlannerRepository {
  private readonly database: PlannerDexieDatabase;
  private readonly ready: Promise<void>;

  constructor(databaseName = "run-planner-desktop-v1") {
    this.database = new PlannerDexieDatabase(databaseName);
    this.ready = this.initializeDefaults();
  }

  async listByDateRange(startISO: string, endISO: string): Promise<Workout[]> {
    await this.ready;
    const normalizedStart = normalizeDateISO(startISO);
    const normalizedEnd = normalizeDateISO(endISO);

    const workouts = await this.database.workouts
      .where("dateISO")
      .between(normalizedStart, normalizedEnd, true, true)
      .toArray();

    return sortWorkoutsDeterministically(workouts);
  }

  async listByDay(dateISO: string): Promise<Workout[]> {
    await this.ready;
    const normalizedDate = normalizeDateISO(dateISO);

    const workouts = await this.database.workouts.where("dateISO").equals(normalizedDate).toArray();
    return sortWorkoutsDeterministically(workouts);
  }

  async createWorkout(input: CreateWorkoutInput): Promise<Workout> {
    await this.ready;

    const record = buildWorkoutRecord(input);
    await this.database.workouts.add(record);

    return record;
  }

  async updateWorkout(id: string, patch: UpdateWorkoutInput): Promise<Workout> {
    await this.ready;

    const existing = await this.database.workouts.get(id);
    if (!existing) {
      throw new Error(`Workout not found for id ${id}`);
    }

    const updated: Workout = {
      ...existing,
      dateISO: patch.dateISO ? normalizeDateISO(patch.dateISO) : existing.dateISO,
      title: patch.title ? patch.title.trim() : existing.title,
      type: patch.type ?? existing.type,
      distanceMiles: patch.distanceMiles === undefined ? existing.distanceMiles : maybeNumber(patch.distanceMiles),
      durationMinutes:
        patch.durationMinutes === undefined ? existing.durationMinutes : maybeNumber(patch.durationMinutes),
      notes: patch.notes === undefined ? existing.notes : sanitizedText(patch.notes),
      updatedAtISO: nowISO()
    };

    await this.database.workouts.put(updated);
    return updated;
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.ready;
    await this.database.workouts.delete(id);
  }

  async setStatus(id: string, status: WorkoutStatus): Promise<Workout> {
    await this.ready;

    const existing = await this.database.workouts.get(id);
    if (!existing) {
      throw new Error(`Workout not found for id ${id}`);
    }

    const updated: Workout = {
      ...existing,
      status,
      updatedAtISO: nowISO()
    };

    await this.database.workouts.put(updated);
    return updated;
  }

  async listTemplates(): Promise<Template[]> {
    await this.ready;

    const templates = await this.database.templates.toArray();
    return [...templates].sort((left, right) => left.label.localeCompare(right.label));
  }

  async getPreferences(): Promise<PlannerPreferences> {
    await this.ready;

    const stored = await this.database.preferences.get("default");
    if (!stored) {
      throw new Error("Preferences not initialized");
    }

    return {
      weekStartsOn: stored.weekStartsOn,
      lastViewedMonthISO: stored.lastViewedMonthISO
    };
  }

  async updatePreferences(patch: Partial<PlannerPreferences>): Promise<PlannerPreferences> {
    await this.ready;

    const existing = await this.database.preferences.get("default");
    if (!existing) {
      throw new Error("Preferences not initialized");
    }

    const updated: StoredPreferences = {
      ...existing,
      ...patch,
      weekStartsOn: "monday",
      lastViewedMonthISO: patch.lastViewedMonthISO ?? existing.lastViewedMonthISO
    };

    await this.database.preferences.put(updated);

    return {
      weekStartsOn: updated.weekStartsOn,
      lastViewedMonthISO: updated.lastViewedMonthISO
    };
  }

  private async initializeDefaults(): Promise<void> {
    await this.database.transaction("rw", this.database.templates, this.database.preferences, async () => {
      const templateCount = await this.database.templates.count();
      if (templateCount === 0) {
        await this.database.templates.bulkAdd(DEFAULT_TEMPLATES);
      }

      const preferences = await this.database.preferences.get("default");
      if (!preferences) {
        const defaultPreferences: StoredPreferences = {
          id: "default",
          weekStartsOn: "monday",
          lastViewedMonthISO: currentMonthISO()
        };
        await this.database.preferences.add(defaultPreferences);
      }
    });
  }
}

export function createDexiePlannerRepository(databaseName?: string): PlannerRepository {
  return new DexiePlannerRepository(databaseName);
}
