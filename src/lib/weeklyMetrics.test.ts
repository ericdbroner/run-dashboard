import { describe, expect, it } from "vitest";
import { buildWeekMetrics, resolveActiveVdotProfile } from "./weeklyMetrics";
import type { VdotProfile, Workout } from "../types/planner";

function makeSimple(
  id: string,
  dateISO: string,
  mileage: number,
  zone: "EL" | "M" | "T" | "I" | "R",
  isLongRun: boolean
): Workout {
  return {
    id,
    dateISO,
    title: id,
    entryMode: "simpleRun",
    status: "planned",
    simpleRun: {
      mileage,
      zone,
      isLongRun
    },
    createdAtISO: "2026-01-01T00:00:00.000Z",
    updatedAtISO: "2026-01-01T00:00:00.000Z"
  };
}

function makeWorkout(id: string, dateISO: string): Workout {
  return {
    id,
    dateISO,
    title: id,
    entryMode: "workout",
    status: "planned",
    workout: {
      warmupDistanceMiles: 1,
      cooldownDistanceMiles: 1,
      blocks: [
        {
          id: `${id}-block-1`,
          repDistanceMiles: 0.25,
          repZone: "T",
          recoveryMode: "time",
          recoveryDurationMinutes: 2,
          repeats: 4
        }
      ]
    },
    createdAtISO: "2026-01-01T00:00:00.000Z",
    updatedAtISO: "2026-01-01T00:00:00.000Z"
  };
}

describe("weekly metrics", () => {
  it("resolves active vdot by effective date", () => {
    const profiles: VdotProfile[] = [
      { id: "a", effectiveDateISO: "2026-03-01", vdot: 42 },
      { id: "b", effectiveDateISO: "2026-04-01", vdot: 46 }
    ];

    expect(resolveActiveVdotProfile(profiles, "2026-03-20")?.vdot).toBe(42);
    expect(resolveActiveVdotProfile(profiles, "2026-04-20")?.vdot).toBe(46);
    expect(resolveActiveVdotProfile(profiles, "2026-02-01")).toBeNull();
  });

  it("computes weekly mileage, zone percentages, and long-run share", () => {
    const profiles: VdotProfile[] = [{ id: "p1", effectiveDateISO: "2026-01-01", vdot: 40 }];
    const entries: Workout[] = [
      makeSimple("long", "2026-04-13", 10, "EL", true),
      makeSimple("m-run", "2026-04-14", 5, "M", false),
      makeWorkout("session", "2026-04-15")
    ];

    const metrics = buildWeekMetrics("2026-04-13", entries, profiles);

    expect(metrics.totalMileage).toBeGreaterThan(18);
    expect(metrics.totalMileage).toBeLessThan(19.5);
    expect(metrics.percentChangeFromPrevious).toBeNull();
    expect(metrics.zonePercentages.EL).toBeGreaterThan(50);
    expect(metrics.zonePercentages.T).toBeGreaterThan(4);
    expect(metrics.zonePercentages.M).toBeGreaterThan(20);
    expect(metrics.longestRunPercent).toBeGreaterThan(50);
  });

  it("excludes skipped entries and calculates week-over-week change", () => {
    const profiles: VdotProfile[] = [{ id: "p1", effectiveDateISO: "2026-01-01", vdot: 45 }];
    const entries: Workout[] = [
      makeSimple("prior", "2026-04-07", 10, "EL", false),
      {
        ...makeSimple("skip", "2026-04-14", 8, "EL", false),
        status: "skipped"
      },
      makeSimple("current", "2026-04-15", 12, "EL", false)
    ];

    const metrics = buildWeekMetrics("2026-04-13", entries, profiles);

    expect(metrics.totalMileage).toBe(12);
    expect(metrics.previousWeekMileage).toBe(10);
    expect(metrics.percentChangeFromPrevious).toBe(20);
  });
});
