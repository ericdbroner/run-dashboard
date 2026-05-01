import Dexie, { type Table } from "dexie";
import { currentMonthISO, normalizeDateISO } from "../lib/date";
import { sortWorkoutsDeterministically } from "../lib/sort";
import { MAX_VDOT, MIN_VDOT, isSupportedVdot } from "../lib/vdotChart";
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
import { DEFAULT_TEMPLATES } from "./defaultTemplates";
import type { PlannerRepository } from "./PlannerRepository";

interface StoredPreferences extends PlannerPreferences {
  id: "default";
}

interface LegacyWorkoutRow {
  id: string;
  dateISO: string;
  title: string;
  type?: string;
  status?: WorkoutStatus;
  distanceMiles?: number;
  durationMinutes?: number;
  notes?: string;
  createdAtISO?: string;
  updatedAtISO?: string;
}

class PlannerDexieDatabase extends Dexie {
  workouts!: Table<Workout | LegacyWorkoutRow, string>;
  templates!: Table<Template, string>;
  preferences!: Table<StoredPreferences, string>;
  vdotProfiles!: Table<VdotProfile, string>;

  constructor(name: string) {
    super(name);

    this.version(1).stores({
      workouts: "id, dateISO, status, [dateISO+status], updatedAtISO",
      templates: "id, label, type",
      preferences: "id"
    });

    this.version(2)
      .stores({
        workouts: "id, dateISO, status, entryMode, [dateISO+status], updatedAtISO",
        templates: "id, label, entryMode",
        preferences: "id",
        vdotProfiles: "id, effectiveDateISO, vdot"
      })
      .upgrade(async (transaction) => {
        const workouts = transaction.table("workouts");
        await workouts.toCollection().modify((raw: LegacyWorkoutRow & Record<string, unknown>) => {
          if (raw.entryMode) {
            return;
          }

          const legacyMiles =
            typeof raw.distanceMiles === "number" && Number.isFinite(raw.distanceMiles) && raw.distanceMiles > 0
              ? raw.distanceMiles
              : 0;

          raw.entryMode = "simpleRun";
          raw.simpleRun = {
            mileage: legacyMiles,
            zone: "EL",
            isLongRun: raw.type === "longRun"
          };
          raw.workout = undefined;

          delete raw.type;
          delete raw.distanceMiles;
          delete raw.durationMinutes;
        });
      });
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

function sanitizedText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function safeMileage(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0;
  }

  return value;
}

function sanitizeWorkoutInput(input: CreateWorkoutInput | UpdateWorkoutInput): Pick<Workout, "entryMode" | "simpleRun" | "workout" | "notes"> {
  const entryMode = input.entryMode ?? "simpleRun";

  if (entryMode === "simpleRun") {
    return {
      entryMode,
      simpleRun: {
        mileage: safeMileage(input.simpleRun?.mileage),
        zone: input.simpleRun?.zone ?? "EL",
        isLongRun: input.simpleRun?.isLongRun ?? false
      },
      workout: undefined,
      notes: sanitizedText(input.notes)
    };
  }

  return {
    entryMode,
    simpleRun: undefined,
    workout: {
      warmupDistanceMiles: safeMileage(input.workout?.warmupDistanceMiles),
      cooldownDistanceMiles: safeMileage(input.workout?.cooldownDistanceMiles),
      blocks: (input.workout?.blocks ?? []).map((block) => ({
        id: block.id,
        repDistanceMiles: safeMileage(block.repDistanceMiles),
        repZone: block.repZone,
        recoveryMode: block.recoveryMode,
        recoveryDistanceMiles: block.recoveryMode === "distance" ? safeMileage(block.recoveryDistanceMiles) : undefined,
        recoveryDurationMinutes: block.recoveryMode === "time" ? safeMileage(block.recoveryDurationMinutes) : undefined,
        repeats: Math.max(1, Math.floor(safeMileage(block.repeats) || 1))
      }))
    },
    notes: sanitizedText(input.notes)
  };
}

function buildWorkoutRecord(input: CreateWorkoutInput): Workout {
  const timestamp = nowISO();
  const details = sanitizeWorkoutInput(input);

  return {
    id: crypto.randomUUID(),
    dateISO: normalizeDateISO(input.dateISO),
    title: input.title.trim(),
    status: input.status ?? "planned",
    createdAtISO: timestamp,
    updatedAtISO: timestamp,
    ...details
  };
}

function clampVdot(vdot: number): number {
  const rounded = Math.round(vdot);
  return Math.max(MIN_VDOT, Math.min(MAX_VDOT, rounded));
}

function resolveActiveProfile(vdotProfiles: VdotProfile[], dateISO: string): VdotProfile | null {
  const eligible = vdotProfiles
    .filter((profile) => profile.effectiveDateISO <= dateISO)
    .sort((left, right) => right.effectiveDateISO.localeCompare(left.effectiveDateISO));

  return eligible[0] ?? null;
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

    return sortWorkoutsDeterministically(workouts as Workout[]);
  }

  async listByDay(dateISO: string): Promise<Workout[]> {
    await this.ready;
    const normalizedDate = normalizeDateISO(dateISO);

    const workouts = await this.database.workouts.where("dateISO").equals(normalizedDate).toArray();
    return sortWorkoutsDeterministically(workouts as Workout[]);
  }

  async createWorkout(input: CreateWorkoutInput): Promise<Workout> {
    await this.ready;

    const record = buildWorkoutRecord(input);
    await this.database.workouts.add(record);

    return record;
  }

  async updateWorkout(id: string, patch: UpdateWorkoutInput): Promise<Workout> {
    await this.ready;

    const existing = (await this.database.workouts.get(id)) as Workout | undefined;
    if (!existing) {
      throw new Error(`Workout not found for id ${id}`);
    }

    const details = sanitizeWorkoutInput({
      ...existing,
      ...patch,
      entryMode: patch.entryMode ?? existing.entryMode,
      simpleRun: patch.simpleRun ?? existing.simpleRun,
      workout: patch.workout ?? existing.workout
    });

    const updated: Workout = {
      ...existing,
      dateISO: patch.dateISO ? normalizeDateISO(patch.dateISO) : existing.dateISO,
      title: patch.title ? patch.title.trim() : existing.title,
      status: patch.status ?? existing.status,
      updatedAtISO: nowISO(),
      ...details
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

    const existing = (await this.database.workouts.get(id)) as Workout | undefined;
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

  async listVdotProfiles(): Promise<VdotProfile[]> {
    await this.ready;
    const profiles = await this.database.vdotProfiles.toArray();
    return [...profiles].sort((left, right) => left.effectiveDateISO.localeCompare(right.effectiveDateISO));
  }

  async createVdotProfile(input: CreateVdotProfileInput): Promise<VdotProfile> {
    await this.ready;

    const normalized = normalizeDateISO(input.effectiveDateISO);
    const vdot = clampVdot(input.vdot);
    if (!isSupportedVdot(vdot)) {
      throw new Error(`Unsupported VDOT ${input.vdot}`);
    }

    const profile: VdotProfile = {
      id: crypto.randomUUID(),
      effectiveDateISO: normalized,
      vdot
    };

    await this.database.vdotProfiles.add(profile);
    return profile;
  }

  async updateVdotProfile(id: string, patch: UpdateVdotProfileInput): Promise<VdotProfile> {
    await this.ready;

    const existing = await this.database.vdotProfiles.get(id);
    if (!existing) {
      throw new Error(`VDOT profile not found for id ${id}`);
    }

    const vdot = patch.vdot === undefined ? existing.vdot : clampVdot(patch.vdot);
    if (!isSupportedVdot(vdot)) {
      throw new Error(`Unsupported VDOT ${patch.vdot}`);
    }

    const updated: VdotProfile = {
      ...existing,
      effectiveDateISO: patch.effectiveDateISO ? normalizeDateISO(patch.effectiveDateISO) : existing.effectiveDateISO,
      vdot
    };

    await this.database.vdotProfiles.put(updated);
    return updated;
  }

  async deleteVdotProfile(id: string): Promise<void> {
    await this.ready;
    await this.database.vdotProfiles.delete(id);
  }

  async resolveActiveVdot(dateISO: string): Promise<VdotProfile | null> {
    await this.ready;

    const profiles = await this.listVdotProfiles();
    return resolveActiveProfile(profiles, normalizeDateISO(dateISO));
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
    await this.database.transaction(
      "rw",
      this.database.templates,
      this.database.preferences,
      this.database.vdotProfiles,
      async () => {
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
      }
    );
  }
}

export function createDexiePlannerRepository(databaseName?: string): PlannerRepository {
  return new DexiePlannerRepository(databaseName);
}
