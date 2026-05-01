import type { PaceZone, WorkoutRepZone } from "../types/planner";

const MILE_METERS = 1_609.34;

type TimeLike = string | number;

interface ChartRowRaw {
  vdot: number;
  elMileRange: [TimeLike, TimeLike];
  mMile: TimeLike;
  t400: TimeLike;
  tKm: TimeLike;
  tMile: TimeLike;
  i400: TimeLike;
  iKm?: TimeLike;
  i1200?: TimeLike;
  r200: TimeLike;
  r300: TimeLike;
  r400?: TimeLike;
  r600?: TimeLike;
}

interface RepPoint {
  meters: number;
  seconds: number;
}

export interface VdotRow {
  vdot: number;
  elLowSecPerMile: number;
  elHighSecPerMile: number;
  mSecPerMile: number;
  tSecPerMile: number;
  tPoints: RepPoint[];
  iPoints: RepPoint[];
  rPoints: RepPoint[];
}

export interface RepTargetResult {
  secPerMile: number;
  clamped: boolean;
}

const CHART_ROWS_RAW: ChartRowRaw[] = [
  { vdot: 30, elMileRange: ["12:00", "13:16"], mMile: "11:21", t400: "2:33", tKm: "6:24", tMile: "10:18", i400: "2:22", r200: 67, r300: "1:41" },
  { vdot: 31, elMileRange: ["11:41", "12:57"], mMile: "11:02", t400: "2:30", tKm: "6:14", tMile: "10:02", i400: "2:18", r200: 65, r300: 98 },
  { vdot: 32, elMileRange: ["11:24", "12:39"], mMile: "10:44", t400: "2:26", tKm: "6:05", tMile: "9:47", i400: "2:14", r200: 63, r300: 95 },
  { vdot: 33, elMileRange: ["11:07", "12:21"], mMile: "10:27", t400: "2:23", tKm: "5:56", tMile: "9:33", i400: "2:11", r200: 61, r300: 92 },
  { vdot: 34, elMileRange: ["10:52", "12:05"], mMile: "10:11", t400: "2:19", tKm: "5:48", tMile: "9:20", i400: "2:08", r200: 60, r300: 90, r400: "2:00" },
  { vdot: 35, elMileRange: ["10:37", "11:49"], mMile: "9:56", t400: "2:16", tKm: "5:40", tMile: "9:07", i400: "2:05", r200: 58, r300: 87, r400: "1:57" },
  { vdot: 36, elMileRange: ["10:23", "11:34"], mMile: "9:41", t400: "2:13", tKm: "5:33", tMile: "8:55", i400: "2:02", r200: 57, r300: 85, r400: "1:54" },
  { vdot: 37, elMileRange: ["10:09", "11:20"], mMile: "9:28", t400: "2:10", tKm: "5:26", tMile: "8:44", i400: "1:59", iKm: "5:00", r200: 55, r300: 83, r400: "1:51" },
  { vdot: 38, elMileRange: ["9:56", "11:06"], mMile: "9:15", t400: "2:07", tKm: "5:19", tMile: "8:33", i400: "1:56", iKm: "4:54", r200: 54, r300: 81, r400: "1:48" },
  { vdot: 39, elMileRange: ["9:44", "10:53"], mMile: "9:02", t400: "2:05", tKm: "5:12", tMile: "8:22", i400: "1:54", iKm: "4:48", r200: 53, r300: 80, r400: "1:46" },
  { vdot: 40, elMileRange: ["9:32", "10:41"], mMile: "8:50", t400: "2:02", tKm: "5:06", tMile: "8:12", i400: "1:52", iKm: "4:42", r200: 52, r300: 78, r400: "1:44" },
  { vdot: 41, elMileRange: ["9:21", "10:28"], mMile: "8:39", t400: "2:00", tKm: "5:00", tMile: "8:02", i400: "1:50", iKm: "4:36", r200: 51, r300: 77, r400: "1:42" },
  { vdot: 42, elMileRange: ["9:10", "10:17"], mMile: "8:28", t400: "1:57", tKm: "4:54", tMile: "7:52", i400: "1:48", iKm: "4:31", r200: 50, r300: 75, r400: "1:40" },
  { vdot: 43, elMileRange: ["9:00", "10:05"], mMile: "8:17", t400: "1:55", tKm: "4:49", tMile: "7:42", i400: "1:46", iKm: "4:26", r200: 49, r300: 74, r400: 98 },
  { vdot: 44, elMileRange: ["8:50", "9:55"], mMile: "8:07", t400: "1:53", tKm: "4:43", tMile: "7:33", i400: "1:44", iKm: "4:21", r200: 48, r300: 72, r400: 96 },
  { vdot: 45, elMileRange: ["8:40", "9:44"], mMile: "7:58", t400: "1:51", tKm: "4:38", tMile: "7:25", i400: "1:42", iKm: "4:16", r200: 47, r300: 71, r400: 94 },
  { vdot: 46, elMileRange: ["8:31", "9:34"], mMile: "7:49", t400: "1:49", tKm: "4:33", tMile: "7:17", i400: "1:40", iKm: "4:12", i1200: "5:00", r200: 46, r300: 69, r400: 92 },
  { vdot: 47, elMileRange: ["8:22", "9:25"], mMile: "7:40", t400: "1:47", tKm: "4:29", tMile: "7:09", i400: 98, iKm: "4:07", i1200: "4:54", r200: 45, r300: 68, r400: 90 },
  { vdot: 48, elMileRange: ["8:13", "9:15"], mMile: "7:32", t400: "1:45", tKm: "4:24", tMile: "7:02", i400: 96, iKm: "4:03", i1200: "4:49", r200: 44, r300: 67, r400: 89 },
  { vdot: 49, elMileRange: ["8:05", "9:06"], mMile: "7:24", t400: "1:43", tKm: "4:20", tMile: "6:56", i400: 95, iKm: "3:59", i1200: "4:45", r200: 44, r300: 66, r400: 88 },
  { vdot: 50, elMileRange: ["7:57", "8:58"], mMile: "7:17", t400: "1:41", tKm: "4:15", tMile: "6:50", i400: 93, iKm: "3:55", i1200: "4:40", r200: 43, r300: 65, r400: 87 },
  { vdot: 51, elMileRange: ["7:49", "8:49"], mMile: "7:09", t400: "1:40", tKm: "4:11", tMile: "6:44", i400: 92, iKm: "3:51", i1200: "4:36", r200: 43, r300: 64, r400: 86 },
  { vdot: 52, elMileRange: ["7:42", "8:41"], mMile: "7:02", t400: 98, tKm: "4:07", tMile: "6:38", i400: 91, iKm: "3:48", i1200: "4:32", r200: 42, r300: 64, r400: 85 },
  { vdot: 53, elMileRange: ["7:35", "8:33"], mMile: "6:56", t400: 97, tKm: "4:04", tMile: "6:32", i400: 90, iKm: "3:44", i1200: "4:29", r200: 42, r300: 63, r400: 84 },
  { vdot: 54, elMileRange: ["7:28", "8:26"], mMile: "6:49", t400: 95, tKm: "4:00", tMile: "6:26", i400: 88, iKm: "3:41", i1200: "4:25", r200: 41, r300: 62, r400: 82 },
  { vdot: 55, elMileRange: ["7:21", "8:18"], mMile: "6:43", t400: 94, tKm: "3:56", tMile: "6:20", i400: 87, iKm: "3:37", i1200: "4:21", r200: 40, r300: 61, r400: 81 },
  { vdot: 56, elMileRange: ["7:15", "8:11"], mMile: "6:37", t400: 93, tKm: "3:53", tMile: "6:15", i400: 86, iKm: "3:34", i1200: "4:18", r200: 40, r300: 60, r400: 80, r600: "2:00" },
  { vdot: 57, elMileRange: ["7:08", "8:04"], mMile: "6:31", t400: 91, tKm: "3:50", tMile: "6:09", i400: 85, iKm: "3:31", i1200: "4:14", r200: 39, r300: 59, r400: 79, r600: "1:57" },
  { vdot: 58, elMileRange: ["7:02", "7:58"], mMile: "6:25", t400: 90, tKm: "3:46", tMile: "6:04", i400: 83, iKm: "3:28", i1200: "4:10", r200: 38, r300: 58, r400: 77, r600: "1:55" },
  { vdot: 59, elMileRange: ["6:56", "7:51"], mMile: "6:19", t400: 89, tKm: "3:43", tMile: "5:59", i400: 82, iKm: "3:25", i1200: "4:07", r200: 38, r300: 57, r400: 76, r600: "1:54" },
  { vdot: 60, elMileRange: ["6:50", "7:45"], mMile: "6:14", t400: 88, tKm: "3:40", tMile: "5:54", i400: 81, iKm: "3:23", i1200: "4:03", r200: 37, r300: 56, r400: 75, r600: "1:52" },
  { vdot: 61, elMileRange: ["6:45", "7:39"], mMile: "6:09", t400: 86, tKm: "3:37", tMile: "5:50", i400: 80, iKm: "3:20", i1200: "4:00", r200: 37, r300: 55, r400: 74, r600: "1:51" },
  { vdot: 62, elMileRange: ["6:39", "7:33"], mMile: "6:04", t400: 85, tKm: "3:34", tMile: "5:45", i400: 79, iKm: "3:17", i1200: "3:57", r200: 36, r300: 54, r400: 73, r600: "1:49" }
];

function parseTimeToSeconds(value: TimeLike): number {
  if (typeof value === "number") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.includes(":")) {
    return Number(trimmed);
  }

  const [minutesText, secondsText] = trimmed.split(":");
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  return minutes * 60 + seconds;
}

function paceString(secondsPerMile: number): string {
  const whole = Math.round(secondsPerMile);
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
}

function toRepPoint(meters: number, time: TimeLike | undefined): RepPoint | null {
  if (time === undefined) {
    return null;
  }

  return {
    meters,
    seconds: parseTimeToSeconds(time)
  };
}

function interpolateRepSecPerMile(points: RepPoint[], repDistanceMiles: number): RepTargetResult | null {
  if (!Number.isFinite(repDistanceMiles) || repDistanceMiles <= 0 || points.length === 0) {
    return null;
  }

  const sorted = [...points].sort((a, b) => a.meters - b.meters);
  const targetMeters = repDistanceMiles * MILE_METERS;

  if (sorted.length === 1) {
    return {
      secPerMile: (sorted[0].seconds / sorted[0].meters) * MILE_METERS,
      clamped: true
    };
  }

  if (targetMeters <= sorted[0].meters) {
    return {
      secPerMile: (sorted[0].seconds / sorted[0].meters) * MILE_METERS,
      clamped: true
    };
  }

  const last = sorted[sorted.length - 1];
  if (targetMeters >= last.meters) {
    return {
      secPerMile: (last.seconds / last.meters) * MILE_METERS,
      clamped: true
    };
  }

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const left = sorted[index];
    const right = sorted[index + 1];
    if (targetMeters >= left.meters && targetMeters <= right.meters) {
      const ratio = (targetMeters - left.meters) / (right.meters - left.meters);
      const interpolatedSeconds = left.seconds + ratio * (right.seconds - left.seconds);
      return {
        secPerMile: (interpolatedSeconds / targetMeters) * MILE_METERS,
        clamped: false
      };
    }
  }

  return null;
}

function buildRow(raw: ChartRowRaw): VdotRow {
  const tPoints = [
    toRepPoint(400, raw.t400),
    toRepPoint(1_000, raw.tKm),
    toRepPoint(MILE_METERS, raw.tMile)
  ].filter((item): item is RepPoint => Boolean(item));

  const iPoints = [
    toRepPoint(400, raw.i400),
    toRepPoint(1_000, raw.iKm),
    toRepPoint(1_200, raw.i1200)
  ].filter((item): item is RepPoint => Boolean(item));

  const rPoints = [
    toRepPoint(200, raw.r200),
    toRepPoint(300, raw.r300),
    toRepPoint(400, raw.r400),
    toRepPoint(600, raw.r600)
  ].filter((item): item is RepPoint => Boolean(item));

  return {
    vdot: raw.vdot,
    elLowSecPerMile: parseTimeToSeconds(raw.elMileRange[0]),
    elHighSecPerMile: parseTimeToSeconds(raw.elMileRange[1]),
    mSecPerMile: parseTimeToSeconds(raw.mMile),
    tSecPerMile: parseTimeToSeconds(raw.tMile),
    tPoints,
    iPoints,
    rPoints
  };
}

export const VDOT_ROWS: VdotRow[] = CHART_ROWS_RAW.map(buildRow);

const ROWS_BY_VDOT = new Map<number, VdotRow>(VDOT_ROWS.map((row) => [row.vdot, row]));

export const SUPPORTED_VDOT_VALUES = VDOT_ROWS.map((row) => row.vdot);
export const MIN_VDOT = Math.min(...SUPPORTED_VDOT_VALUES);
export const MAX_VDOT = Math.max(...SUPPORTED_VDOT_VALUES);

export function getVdotRow(vdot: number): VdotRow | null {
  return ROWS_BY_VDOT.get(vdot) ?? null;
}

export function isSupportedVdot(vdot: number): boolean {
  return ROWS_BY_VDOT.has(vdot);
}

export function formatSecondsPerMile(secondsPerMile: number): string {
  return `${paceString(secondsPerMile)} /mi`;
}

export function formatEasyLongRange(vdot: number): string | null {
  const row = getVdotRow(vdot);
  if (!row) {
    return null;
  }

  return `${paceString(row.elLowSecPerMile)}-${paceString(row.elHighSecPerMile)} /mi`;
}

export function easyLongMidpointSecPerMile(vdot: number): number | null {
  const row = getVdotRow(vdot);
  if (!row) {
    return null;
  }

  return (row.elLowSecPerMile + row.elHighSecPerMile) / 2;
}

export function zoneTargetSecPerMile(vdot: number, zone: PaceZone): number | null {
  const row = getVdotRow(vdot);
  if (!row) {
    return null;
  }

  if (zone === "EL") {
    return null;
  }

  if (zone === "M") {
    return row.mSecPerMile;
  }

  if (zone === "T") {
    return row.tSecPerMile;
  }

  const points = zone === "I" ? row.iPoints : row.rPoints;
  if (points.length === 0) {
    return null;
  }

  const result = interpolateRepSecPerMile(points, 1);
  return result?.secPerMile ?? null;
}

export function repTargetSecPerMile(
  vdot: number,
  zone: WorkoutRepZone,
  repDistanceMiles: number
): RepTargetResult | null {
  const row = getVdotRow(vdot);
  if (!row) {
    return null;
  }

  if (zone === "M") {
    return {
      secPerMile: row.mSecPerMile,
      clamped: false
    };
  }

  const points = zone === "T" ? row.tPoints : zone === "I" ? row.iPoints : row.rPoints;
  return interpolateRepSecPerMile(points, repDistanceMiles);
}
