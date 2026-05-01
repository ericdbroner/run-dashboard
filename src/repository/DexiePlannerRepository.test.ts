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
  it("supports structured workout CRUD and vdot profile operations", async () => {
    const repository = createRepository();

    const created = await repository.createWorkout({
      dateISO: "2026-04-10",
      title: "Easy Run",
      entryMode: "simpleRun",
      simpleRun: {
        mileage: 4,
        zone: "EL",
        isLongRun: false
      }
    });

    await repository.createWorkout({
      dateISO: "2026-04-11",
      title: "Track",
      entryMode: "workout",
      workout: {
        warmupDistanceMiles: 1,
        cooldownDistanceMiles: 1,
        blocks: [
          {
            id: "b1",
            repDistanceMiles: 0.25,
            repZone: "T",
            recoveryMode: "distance",
            recoveryDistanceMiles: 0.25,
            repeats: 4
          }
        ]
      }
    });

    await repository.updateWorkout(created.id, {
      title: "Easy Run Updated",
      simpleRun: {
        mileage: 5,
        zone: "M",
        isLongRun: false
      }
    });

    const byDay = await repository.listByDay("2026-04-10");
    expect(byDay).toHaveLength(1);
    expect(byDay[0].title).toBe("Easy Run Updated");
    expect(byDay[0].simpleRun?.zone).toBe("M");

    const profileA = await repository.createVdotProfile({ effectiveDateISO: "2026-04-01", vdot: 45 });
    await repository.createVdotProfile({ effectiveDateISO: "2026-05-01", vdot: 50 });
    const active = await repository.resolveActiveVdot("2026-04-20");
    expect(active?.id).toBe(profileA.id);

    await repository.deleteWorkout(created.id);
    expect(await repository.listByDay("2026-04-10")).toHaveLength(0);
  });

  it("migrates legacy workouts into simpleRun mode", async () => {
    const databaseName = `planner-legacy-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);

    const legacyDb = new Dexie(databaseName);
    legacyDb.version(1).stores({
      workouts: "id, dateISO, status, [dateISO+status], updatedAtISO",
      templates: "id, label, type",
      preferences: "id"
    });

    await legacyDb.open();
    await legacyDb.table("workouts").add({
      id: "legacy-1",
      dateISO: "2026-04-10",
      title: "Legacy Long",
      type: "longRun",
      status: "planned",
      distanceMiles: 9,
      durationMinutes: 88,
      createdAtISO: "2026-01-01T00:00:00.000Z",
      updatedAtISO: "2026-01-01T00:00:00.000Z"
    });
    await legacyDb.table("preferences").add({
      id: "default",
      weekStartsOn: "monday",
      lastViewedMonthISO: "2026-04"
    });
    await legacyDb.close();

    const repository = new DexiePlannerRepository(databaseName);
    const migrated = await repository.listByDay("2026-04-10");

    expect(migrated).toHaveLength(1);
    expect(migrated[0].entryMode).toBe("simpleRun");
    expect(migrated[0].simpleRun?.isLongRun).toBe(true);
    expect(migrated[0].simpleRun?.mileage).toBe(9);
  });
});
