import type { Template } from "../types/planner";

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "template-simple-el",
    label: "Simple Easy/Long",
    entryMode: "simpleRun",
    defaultTitle: "Easy Run",
    defaultSimpleRun: {
      mileage: 4,
      zone: "EL",
      isLongRun: false
    }
  },
  {
    id: "template-workout",
    label: "Workout Session",
    entryMode: "workout",
    defaultTitle: "Workout",
    defaultWorkout: {
      warmupDistanceMiles: 1.5,
      cooldownDistanceMiles: 1,
      blocks: []
    }
  }
];
