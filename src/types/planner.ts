export type PaceZone = "EL" | "M" | "T" | "I" | "R";

export type WorkoutStatus = "planned" | "completed" | "skipped";

export type EntryMode = "simpleRun" | "workout";

export type RecoveryMode = "distance" | "time";

export type WorkoutRepZone = "M" | "T" | "I" | "R";

export interface WorkoutBlock {
  id: string;
  repDistanceMiles: number;
  repZone: WorkoutRepZone;
  recoveryMode: RecoveryMode;
  recoveryDistanceMiles?: number;
  recoveryDurationMinutes?: number;
  repeats: number;
}

export interface WorkoutDetails {
  warmupDistanceMiles: number;
  cooldownDistanceMiles: number;
  blocks: WorkoutBlock[];
}

export interface SimpleRunDetails {
  mileage: number;
  zone: PaceZone;
  isLongRun: boolean;
}

export interface Workout {
  id: string;
  dateISO: string;
  title: string;
  entryMode: EntryMode;
  status: WorkoutStatus;
  notes?: string;
  simpleRun?: SimpleRunDetails;
  workout?: WorkoutDetails;
  createdAtISO: string;
  updatedAtISO: string;
}

export interface Template {
  id: string;
  label: string;
  entryMode: EntryMode;
  defaultTitle?: string;
  defaultSimpleRun?: Partial<SimpleRunDetails>;
  defaultWorkout?: Partial<WorkoutDetails>;
}

export interface VdotProfile {
  id: string;
  effectiveDateISO: string;
  vdot: number;
}

export interface PlannerPreferences {
  weekStartsOn: "monday";
  lastViewedMonthISO: string;
}

export interface CreateWorkoutInput {
  dateISO: string;
  title: string;
  entryMode: EntryMode;
  status?: WorkoutStatus;
  notes?: string;
  simpleRun?: SimpleRunDetails;
  workout?: WorkoutDetails;
}

export interface UpdateWorkoutInput {
  dateISO?: string;
  title?: string;
  entryMode?: EntryMode;
  status?: WorkoutStatus;
  notes?: string;
  simpleRun?: SimpleRunDetails;
  workout?: WorkoutDetails;
}

export interface CreateVdotProfileInput {
  effectiveDateISO: string;
  vdot: number;
}

export interface UpdateVdotProfileInput {
  effectiveDateISO?: string;
  vdot?: number;
}
