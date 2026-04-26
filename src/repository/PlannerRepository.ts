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

export interface PlannerRepository {
  listByDateRange(startISO: string, endISO: string): Promise<Workout[]>;
  listByDay(dateISO: string): Promise<Workout[]>;
  createWorkout(input: CreateWorkoutInput): Promise<Workout>;
  updateWorkout(id: string, patch: UpdateWorkoutInput): Promise<Workout>;
  deleteWorkout(id: string): Promise<void>;
  setStatus(id: string, status: WorkoutStatus): Promise<Workout>;

  listTemplates(): Promise<Template[]>;

  listVdotProfiles(): Promise<VdotProfile[]>;
  createVdotProfile(input: CreateVdotProfileInput): Promise<VdotProfile>;
  updateVdotProfile(id: string, patch: UpdateVdotProfileInput): Promise<VdotProfile>;
  deleteVdotProfile(id: string): Promise<void>;
  resolveActiveVdot(dateISO: string): Promise<VdotProfile | null>;

  getPreferences(): Promise<PlannerPreferences>;
  updatePreferences(patch: Partial<PlannerPreferences>): Promise<PlannerPreferences>;
}
