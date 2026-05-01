import { addDaysISO, isDateISOInRange } from "./date";
import { easyLongMidpointSecPerMile } from "./vdotChart";
import type { PaceZone, VdotProfile, Workout } from "../types/planner";

export interface WeekMetrics {
  weekStartISO: string;
  weekEndISO: string;
  totalMileage: number;
  previousWeekMileage: number;
  percentChangeFromPrevious: number | null;
  zonePercentages: Record<PaceZone, number>;
  longestRunPercent: number;
}

const ZERO_ZONES: Record<PaceZone, number> = {
  EL: 0,
  M: 0,
  T: 0,
  I: 0,
  R: 0
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function isIncludedStatus(status: Workout["status"]): boolean {
  return status === "planned" || status === "completed";
}

export function resolveActiveVdotProfile(vdotProfiles: VdotProfile[], dateISO: string): VdotProfile | null {
  const eligible = vdotProfiles
    .filter((profile) => profile.effectiveDateISO <= dateISO)
    .sort((left, right) => right.effectiveDateISO.localeCompare(left.effectiveDateISO));

  return eligible[0] ?? null;
}

interface EntryBreakdown {
  totalMileage: number;
  zoneMileage: Record<PaceZone, number>;
  longRunMileageCandidate: number;
}

function safeNumber(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0;
  }

  return value;
}

function breakdownEntry(entry: Workout, profiles: VdotProfile[]): EntryBreakdown {
  if (entry.entryMode === "simpleRun") {
    const mileage = safeNumber(entry.simpleRun?.mileage);
    const zone = entry.simpleRun?.zone ?? "EL";
    const zoneMileage = { ...ZERO_ZONES, [zone]: mileage };

    return {
      totalMileage: mileage,
      zoneMileage,
      longRunMileageCandidate: entry.simpleRun?.isLongRun ? mileage : 0
    };
  }

  const details = entry.workout;
  if (!details) {
    return {
      totalMileage: 0,
      zoneMileage: { ...ZERO_ZONES },
      longRunMileageCandidate: 0
    };
  }

  let totalMileage = 0;
  const zoneMileage: Record<PaceZone, number> = { ...ZERO_ZONES };

  const warmupMiles = safeNumber(details.warmupDistanceMiles);
  const cooldownMiles = safeNumber(details.cooldownDistanceMiles);
  totalMileage += warmupMiles + cooldownMiles;
  zoneMileage.EL += warmupMiles + cooldownMiles;

  const activeVdot = resolveActiveVdotProfile(profiles, entry.dateISO);
  const easyMidpointSecPerMile = activeVdot ? easyLongMidpointSecPerMile(activeVdot.vdot) : null;

  for (const block of details.blocks) {
    const repeats = Math.max(1, Math.floor(safeNumber(block.repeats)));
    const repMiles = safeNumber(block.repDistanceMiles) * repeats;
    totalMileage += repMiles;
    zoneMileage[block.repZone] += repMiles;

    if (block.recoveryMode === "distance") {
      const recoveryMiles = safeNumber(block.recoveryDistanceMiles) * repeats;
      totalMileage += recoveryMiles;
      zoneMileage.EL += recoveryMiles;
      continue;
    }

    const recoveryMinutes = safeNumber(block.recoveryDurationMinutes);
    if (!easyMidpointSecPerMile || recoveryMinutes <= 0) {
      continue;
    }

    const recoveryMiles = (recoveryMinutes * 60 * repeats) / easyMidpointSecPerMile;
    totalMileage += recoveryMiles;
    zoneMileage.EL += recoveryMiles;
  }

  return {
    totalMileage,
    zoneMileage,
    longRunMileageCandidate: 0
  };
}

export function calculateWeekMileage(entryList: Workout[], profiles: VdotProfile[], weekStartISO: string): number {
  const weekEndISO = addDaysISO(weekStartISO, 6);

  return round(
    entryList
      .filter((entry) => isIncludedStatus(entry.status) && isDateISOInRange(entry.dateISO, weekStartISO, weekEndISO))
      .map((entry) => breakdownEntry(entry, profiles).totalMileage)
      .reduce((sum, item) => sum + item, 0)
  );
}

export function buildWeekMetrics(
  weekStartISO: string,
  allEntries: Workout[],
  profiles: VdotProfile[]
): WeekMetrics {
  const weekEndISO = addDaysISO(weekStartISO, 6);
  const previousStartISO = addDaysISO(weekStartISO, -7);

  const weekEntries = allEntries.filter(
    (entry) => isIncludedStatus(entry.status) && isDateISOInRange(entry.dateISO, weekStartISO, weekEndISO)
  );

  const previousMileage = calculateWeekMileage(allEntries, profiles, previousStartISO);

  let totalMileage = 0;
  const zoneMileage: Record<PaceZone, number> = { ...ZERO_ZONES };
  let longestRun = 0;

  for (const entry of weekEntries) {
    const breakdown = breakdownEntry(entry, profiles);
    totalMileage += breakdown.totalMileage;
    longestRun = Math.max(longestRun, breakdown.longRunMileageCandidate);

    zoneMileage.EL += breakdown.zoneMileage.EL;
    zoneMileage.M += breakdown.zoneMileage.M;
    zoneMileage.T += breakdown.zoneMileage.T;
    zoneMileage.I += breakdown.zoneMileage.I;
    zoneMileage.R += breakdown.zoneMileage.R;
  }

  const roundedTotal = round(totalMileage);
  const zonePercentages: Record<PaceZone, number> = {
    EL: roundedTotal > 0 ? round((zoneMileage.EL / roundedTotal) * 100) : 0,
    M: roundedTotal > 0 ? round((zoneMileage.M / roundedTotal) * 100) : 0,
    T: roundedTotal > 0 ? round((zoneMileage.T / roundedTotal) * 100) : 0,
    I: roundedTotal > 0 ? round((zoneMileage.I / roundedTotal) * 100) : 0,
    R: roundedTotal > 0 ? round((zoneMileage.R / roundedTotal) * 100) : 0
  };

  return {
    weekStartISO,
    weekEndISO,
    totalMileage: roundedTotal,
    previousWeekMileage: previousMileage,
    percentChangeFromPrevious:
      previousMileage > 0 ? round(((roundedTotal - previousMileage) / previousMileage) * 100) : null,
    zonePercentages,
    longestRunPercent: roundedTotal > 0 ? round((longestRun / roundedTotal) * 100) : 0
  };
}
