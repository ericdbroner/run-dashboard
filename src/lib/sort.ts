import type { Workout } from "../types/planner";

export function sortWorkoutsDeterministically(workouts: Workout[]): Workout[] {
  return [...workouts].sort((left, right) => {
    if (left.dateISO !== right.dateISO) {
      return left.dateISO.localeCompare(right.dateISO);
    }

    const titleCompare = left.title.localeCompare(right.title);
    if (titleCompare !== 0) {
      return titleCompare;
    }

    return left.id.localeCompare(right.id);
  });
}
