import { describe, expect, it } from "vitest";
import { buildMonthGrid } from "./calendar";
import { normalizeDateISO } from "./date";
import { sortWorkoutsDeterministically } from "./sort";
import type { Workout } from "../types/planner";

describe("calendar utils", () => {
  it("builds a monday-start 42-cell month grid", () => {
    const cells = buildMonthGrid("2026-04");

    expect(cells).toHaveLength(42);
    expect(cells[0].dateISO).toBe("2026-03-30");
    expect(cells[0].inCurrentMonth).toBe(false);
    expect(cells[1].dateISO).toBe("2026-03-31");
    expect(cells[2].dateISO).toBe("2026-04-01");
    expect(cells[2].inCurrentMonth).toBe(true);
  });

  it("normalizes date keys to YYYY-MM-DD", () => {
    expect(normalizeDateISO("2026-4-9")).toBe("2026-04-09");
  });

  it("sorts workouts deterministically", () => {
    const workouts: Workout[] = [
      {
        id: "b",
        dateISO: "2026-04-04",
        title: "Easy",
        type: "easy",
        status: "planned",
        createdAtISO: "t",
        updatedAtISO: "t"
      },
      {
        id: "a",
        dateISO: "2026-04-04",
        title: "Easy",
        type: "easy",
        status: "planned",
        createdAtISO: "t",
        updatedAtISO: "t"
      },
      {
        id: "z",
        dateISO: "2026-04-03",
        title: "Threshold",
        type: "threshold",
        status: "planned",
        createdAtISO: "t",
        updatedAtISO: "t"
      }
    ];

    const sorted = sortWorkoutsDeterministically(workouts);
    expect(sorted.map((item) => item.id)).toEqual(["z", "a", "b"]);
  });
});
