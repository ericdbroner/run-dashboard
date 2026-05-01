import { describe, expect, it } from "vitest";
import {
  MAX_VDOT,
  MIN_VDOT,
  formatEasyLongRange,
  formatSecondsPerMile,
  repTargetSecPerMile,
  zoneTargetSecPerMile
} from "./vdotChart";

describe("vdot chart", () => {
  it("returns exact EL range and M/T pace targets for supported rows", () => {
    expect(formatEasyLongRange(40)).toBe("9:32-10:41 /mi");
    expect(formatSecondsPerMile(zoneTargetSecPerMile(40, "M") ?? 0)).toBe("8:50 /mi");
    expect(formatSecondsPerMile(zoneTargetSecPerMile(40, "T") ?? 0)).toBe("8:12 /mi");
  });

  it("interpolates rep pace for arbitrary distances", () => {
    const target = repTargetSecPerMile(50, "I", 0.5);
    expect(target).not.toBeNull();
    expect(target?.clamped).toBe(false);

    const label = formatSecondsPerMile(target?.secPerMile ?? 0);
    expect(label).toMatch(/\/mi$/);
  });

  it("clamps when rep distance is outside available distance points", () => {
    const longRep = repTargetSecPerMile(30, "R", 1.0);
    expect(longRep).not.toBeNull();
    expect(longRep?.clamped).toBe(true);
  });

  it("enforces supported VDOT boundaries", () => {
    expect(MIN_VDOT).toBe(30);
    expect(MAX_VDOT).toBe(62);
    expect(zoneTargetSecPerMile(29, "M")).toBeNull();
    expect(repTargetSecPerMile(63, "T", 0.25)).toBeNull();
  });
});
