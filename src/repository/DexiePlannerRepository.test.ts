import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { DexiePlannerRepository } from "./DexiePlannerRepository";

const databaseNames: string[] = [];

function createRepository(): DexiePlannerRepository {
  const databaseName = `planner-test-${crypto.randomUUID()}`;
  databaseNames.push(databaseName);
  return new DexiePlannerRepository(databaseName);
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0, databaseNames.length).map((name) => Dexie.delete(name)));
});

describe("DexiePlannerRepository", () => {
  it("supports CRUD and date-range queries", async () => {
    const repository = createRepository();

    const created = await repository.createWorkout({
      dateISO: "2026-04-10",
      title: "Easy Run",
      type: "easy",
      distanceMiles: 4,
      durationMinutes: 42
    });

    await repository.createWorkout({
      dateISO: "2026-04-12",
      title: "Long Run",
      type: "longRun",
      distanceMiles: 8,
      durationMinutes: 80
    });

    await repository.updateWorkout(created.id, {
      title: "Easy Run Updated",
      notes: "Felt strong"
    });

    await repository.setStatus(created.id, "completed");

    const byDay = await repository.listByDay("2026-04-10");
    expect(byDay).toHaveLength(1);
    expect(byDay[0].title).toBe("Easy Run Updated");
    expect(byDay[0].status).toBe("completed");

    const byRange = await repository.listByDateRange("2026-04-09", "2026-04-12");
    expect(byRange).toHaveLength(2);

    await repository.deleteWorkout(created.id);

    const afterDelete = await repository.listByDay("2026-04-10");
    expect(afterDelete).toHaveLength(0);
  });

  it("seeds templates and persists data across repository instances", async () => {
    const databaseName = `planner-persist-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);

    const repo1 = new DexiePlannerRepository(databaseName);
    const templates = await repo1.listTemplates();
    expect(templates.length).toBeGreaterThan(0);

    await repo1.createWorkout({
      dateISO: "2026-05-01",
      title: "Tempo",
      type: "tempo"
    });

    const repo2 = new DexiePlannerRepository(databaseName);
    const sameDay = await repo2.listByDay("2026-05-01");
    expect(sameDay).toHaveLength(1);
    expect(sameDay[0].title).toBe("Tempo");
  });
});
