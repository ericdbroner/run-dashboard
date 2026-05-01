import { useEffect, useState } from "react";
import { labelForDateISO } from "../lib/date";
import { formatEasyLongRange, formatSecondsPerMile, repTargetSecPerMile, zoneTargetSecPerMile } from "../lib/vdotChart";
import type {
  CreateWorkoutInput,
  PaceZone,
  UpdateWorkoutInput,
  VdotProfile,
  Workout,
  WorkoutBlock,
  WorkoutRepZone,
  WorkoutStatus
} from "../types/planner";

interface DayDetailPanelProps {
  dateISO: string;
  workouts: Workout[];
  activeVdot: VdotProfile | null;
  resolveVdotForDate: (dateISO: string) => VdotProfile | null;
  onCreateWorkout: (input: CreateWorkoutInput) => Promise<void>;
  onUpdateWorkout: (id: string, patch: UpdateWorkoutInput) => Promise<void>;
  onSetStatus: (id: string, status: WorkoutStatus) => Promise<void>;
  onDeleteWorkout: (id: string) => Promise<void>;
}

const PACE_ZONES: PaceZone[] = ["EL", "M", "T", "I", "R"];
const REP_ZONES: WorkoutRepZone[] = ["M", "T", "I", "R"];

interface WorkoutBlockDraft {
  id: string;
  repDistanceMiles: string;
  repZone: WorkoutRepZone;
  recoveryMode: "distance" | "time";
  recoveryDistanceMiles: string;
  recoveryDurationMinutes: string;
  repeats: string;
}

interface EntryDraft {
  dateISO: string;
  title: string;
  status: WorkoutStatus;
  notes: string;
  entryMode: "simpleRun" | "workout";
  simpleRun: {
    mileage: string;
    zone: PaceZone;
    isLongRun: boolean;
  };
  workout: {
    warmupDistanceMiles: string;
    cooldownDistanceMiles: string;
    blocks: WorkoutBlockDraft[];
  };
}

function makeBlockDraft(): WorkoutBlockDraft {
  return {
    id: crypto.randomUUID(),
    repDistanceMiles: "0.25",
    repZone: "T",
    recoveryMode: "distance",
    recoveryDistanceMiles: "0.25",
    recoveryDurationMinutes: "2",
    repeats: "4"
  };
}

function makeDefaultDraft(dateISO: string): EntryDraft {
  return {
    dateISO,
    title: "",
    status: "planned",
    notes: "",
    entryMode: "simpleRun",
    simpleRun: {
      mileage: "4",
      zone: "EL",
      isLongRun: false
    },
    workout: {
      warmupDistanceMiles: "1.5",
      cooldownDistanceMiles: "1",
      blocks: [makeBlockDraft()]
    }
  };
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function zoneLabel(zone: PaceZone): string {
  if (zone === "EL") {
    return "E/L";
  }

  return zone;
}

function blockToModel(block: WorkoutBlockDraft): WorkoutBlock | null {
  const repDistanceMiles = parsePositiveNumber(block.repDistanceMiles);
  const repeats = parsePositiveNumber(block.repeats);

  if (!repDistanceMiles || !repeats) {
    return null;
  }

  if (block.recoveryMode === "distance") {
    return {
      id: block.id,
      repDistanceMiles,
      repZone: block.repZone,
      recoveryMode: "distance",
      recoveryDistanceMiles: parseNonNegativeNumber(block.recoveryDistanceMiles),
      repeats: Math.max(1, Math.floor(repeats))
    };
  }

  const recoveryDurationMinutes = parsePositiveNumber(block.recoveryDurationMinutes);
  if (!recoveryDurationMinutes) {
    return null;
  }

  return {
    id: block.id,
    repDistanceMiles,
    repZone: block.repZone,
    recoveryMode: "time",
    recoveryDurationMinutes,
    repeats: Math.max(1, Math.floor(repeats))
  };
}

function workoutToDraft(workout: Workout): EntryDraft {
  const base = makeDefaultDraft(workout.dateISO);

  if (workout.entryMode === "simpleRun") {
    return {
      ...base,
      title: workout.title,
      status: workout.status,
      notes: workout.notes ?? "",
      entryMode: "simpleRun",
      simpleRun: {
        mileage: (workout.simpleRun?.mileage ?? 0).toString(),
        zone: workout.simpleRun?.zone ?? "EL",
        isLongRun: workout.simpleRun?.isLongRun ?? false
      }
    };
  }

  return {
    ...base,
    title: workout.title,
    status: workout.status,
    notes: workout.notes ?? "",
    entryMode: "workout",
    workout: {
      warmupDistanceMiles: (workout.workout?.warmupDistanceMiles ?? 0).toString(),
      cooldownDistanceMiles: (workout.workout?.cooldownDistanceMiles ?? 0).toString(),
      blocks:
        workout.workout?.blocks.map((block) => ({
          id: block.id,
          repDistanceMiles: block.repDistanceMiles.toString(),
          repZone: block.repZone,
          recoveryMode: block.recoveryMode,
          recoveryDistanceMiles: (block.recoveryDistanceMiles ?? 0).toString(),
          recoveryDurationMinutes: (block.recoveryDurationMinutes ?? 0).toString(),
          repeats: block.repeats.toString()
        })) ?? [makeBlockDraft()]
    }
  };
}

function buildInputFromDraft(
  draft: EntryDraft,
  resolveVdotForDate: (dateISO: string) => VdotProfile | null
): { input: CreateWorkoutInput; error?: string } {
  const title = draft.title.trim();
  if (!title) {
    return { input: {} as CreateWorkoutInput, error: "Title is required." };
  }

  if (draft.entryMode === "simpleRun") {
    const mileage = parsePositiveNumber(draft.simpleRun.mileage);
    if (!mileage) {
      return { input: {} as CreateWorkoutInput, error: "Simple run mileage must be greater than 0." };
    }

    return {
      input: {
        dateISO: draft.dateISO,
        title,
        status: draft.status,
        notes: draft.notes,
        entryMode: "simpleRun",
        simpleRun: {
          mileage,
          zone: draft.simpleRun.zone,
          isLongRun: draft.simpleRun.isLongRun
        }
      }
    };
  }

  const blocks = draft.workout.blocks.map(blockToModel);
  if (blocks.some((block) => block === null)) {
    return { input: {} as CreateWorkoutInput, error: "Every workout block needs rep distance and valid recovery/repeat values." };
  }

  const resolvedBlocks = blocks as WorkoutBlock[];
  const activeVdot = resolveVdotForDate(draft.dateISO);

  for (const block of resolvedBlocks) {
    if (block.recoveryMode === "time" && !activeVdot) {
      return { input: {} as CreateWorkoutInput, error: "Timed recovery requires an active VDOT profile for this date." };
    }

    const repTarget = activeVdot
      ? repTargetSecPerMile(activeVdot.vdot, block.repZone, block.repDistanceMiles)
      : null;

    if (activeVdot && !repTarget) {
      return {
        input: {} as CreateWorkoutInput,
        error: `No ${block.repZone} rep target available for this VDOT/distance combination.`
      };
    }
  }

  return {
    input: {
      dateISO: draft.dateISO,
      title,
      status: draft.status,
      notes: draft.notes,
      entryMode: "workout",
      workout: {
        warmupDistanceMiles: parseNonNegativeNumber(draft.workout.warmupDistanceMiles),
        cooldownDistanceMiles: parseNonNegativeNumber(draft.workout.cooldownDistanceMiles),
        blocks: resolvedBlocks
      }
    }
  };
}

function simplePaceLabel(profile: VdotProfile | null, zone: PaceZone): string {
  if (!profile) {
    return "Set VDOT profile to show pace target.";
  }

  if (zone === "EL") {
    return formatEasyLongRange(profile.vdot) ?? "Unavailable";
  }

  const sec = zoneTargetSecPerMile(profile.vdot, zone);
  return sec ? formatSecondsPerMile(sec) : "Unavailable";
}

function repPaceLabel(profile: VdotProfile | null, zone: WorkoutRepZone, repDistanceMiles: string): string {
  if (!profile) {
    return "Set VDOT profile to show rep target.";
  }

  const distanceMiles = parsePositiveNumber(repDistanceMiles);
  if (!distanceMiles) {
    return "Enter rep distance.";
  }

  const target = repTargetSecPerMile(profile.vdot, zone, distanceMiles);
  if (!target) {
    return "Unavailable for this VDOT/distance.";
  }

  return `${formatSecondsPerMile(target.secPerMile)}${target.clamped ? " (clamped)" : ""}`;
}

function entrySummary(workout: Workout): string {
  if (workout.entryMode === "simpleRun") {
    const details = workout.simpleRun;
    if (!details) {
      return "Simple run";
    }

    return `${details.mileage.toFixed(2)} mi • ${zoneLabel(details.zone)}${details.isLongRun ? " • Long Run" : ""}`;
  }

  const details = workout.workout;
  if (!details) {
    return "Workout";
  }

  return `${details.blocks.length} block${details.blocks.length === 1 ? "" : "s"} • WU ${details.warmupDistanceMiles.toFixed(2)} mi • CD ${details.cooldownDistanceMiles.toFixed(2)} mi`;
}

function EntryForm({
  draft,
  setDraft,
  resolveVdotForDate,
  onSubmit,
  submitLabel,
  onCancel,
  errorMessage
}: {
  draft: EntryDraft;
  setDraft: (draft: EntryDraft) => void;
  resolveVdotForDate: (dateISO: string) => VdotProfile | null;
  onSubmit: () => Promise<void>;
  submitLabel: string;
  onCancel?: () => void;
  errorMessage: string;
}) {
  const vdot = resolveVdotForDate(draft.dateISO);

  return (
    <form
      className="entry-form"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit();
      }}
    >
      <div className="form-grid">
        <label>
          Title
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Workout title"
          />
        </label>

        <label>
          Date
          <input
            type="date"
            value={draft.dateISO}
            onChange={(event) => setDraft({ ...draft, dateISO: event.target.value })}
          />
        </label>

        <label>
          Status
          <select
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value as WorkoutStatus })}
          >
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
            <option value="skipped">Skipped</option>
          </select>
        </label>

        <label>
          Entry Mode
          <select
            value={draft.entryMode}
            onChange={(event) => setDraft({ ...draft, entryMode: event.target.value as "simpleRun" | "workout" })}
          >
            <option value="simpleRun">Simple Run</option>
            <option value="workout">Workout</option>
          </select>
        </label>
      </div>

      {draft.entryMode === "simpleRun" ? (
        <section className="mode-panel">
          <h4>Simple Run</h4>
          <div className="form-grid">
            <label>
              Mileage
              <input
                value={draft.simpleRun.mileage}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    simpleRun: { ...draft.simpleRun, mileage: event.target.value }
                  })
                }
              />
            </label>

            <label>
              Zone
              <select
                value={draft.simpleRun.zone}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    simpleRun: { ...draft.simpleRun, zone: event.target.value as PaceZone }
                  })
                }
              >
                {PACE_ZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zoneLabel(zone)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.simpleRun.isLongRun}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  simpleRun: { ...draft.simpleRun, isLongRun: event.target.checked }
                })
              }
            />
            Long Run
          </label>

          <p className="hint">Target pace: {simplePaceLabel(vdot, draft.simpleRun.zone)}</p>
        </section>
      ) : (
        <section className="mode-panel">
          <h4>Workout</h4>
          <div className="form-grid">
            <label>
              Warmup Distance (mi)
              <input
                value={draft.workout.warmupDistanceMiles}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    workout: { ...draft.workout, warmupDistanceMiles: event.target.value }
                  })
                }
              />
            </label>

            <label>
              Cooldown Distance (mi)
              <input
                value={draft.workout.cooldownDistanceMiles}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    workout: { ...draft.workout, cooldownDistanceMiles: event.target.value }
                  })
                }
              />
            </label>
          </div>

          {draft.workout.blocks.map((block, index) => (
            <fieldset className="block-card" key={block.id}>
              <legend>Block {index + 1}</legend>

              <div className="form-grid">
                <label>
                  Rep Distance (mi)
                  <input
                    value={block.repDistanceMiles}
                    onChange={(event) => {
                      const nextBlocks = draft.workout.blocks.map((item) =>
                        item.id === block.id ? { ...item, repDistanceMiles: event.target.value } : item
                      );
                      setDraft({ ...draft, workout: { ...draft.workout, blocks: nextBlocks } });
                    }}
                  />
                </label>

                <label>
                  Rep Zone
                  <select
                    value={block.repZone}
                    onChange={(event) => {
                      const nextBlocks = draft.workout.blocks.map((item) =>
                        item.id === block.id ? { ...item, repZone: event.target.value as WorkoutRepZone } : item
                      );
                      setDraft({ ...draft, workout: { ...draft.workout, blocks: nextBlocks } });
                    }}
                  >
                    {REP_ZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Repeats
                  <input
                    value={block.repeats}
                    onChange={(event) => {
                      const nextBlocks = draft.workout.blocks.map((item) =>
                        item.id === block.id ? { ...item, repeats: event.target.value } : item
                      );
                      setDraft({ ...draft, workout: { ...draft.workout, blocks: nextBlocks } });
                    }}
                  />
                </label>

                <label>
                  Recovery Mode
                  <select
                    value={block.recoveryMode}
                    onChange={(event) => {
                      const mode = event.target.value as "distance" | "time";
                      const nextBlocks = draft.workout.blocks.map((item) =>
                        item.id === block.id ? { ...item, recoveryMode: mode } : item
                      );
                      setDraft({ ...draft, workout: { ...draft.workout, blocks: nextBlocks } });
                    }}
                  >
                    <option value="distance">Distance</option>
                    <option value="time">Time</option>
                  </select>
                </label>

                {block.recoveryMode === "distance" ? (
                  <label>
                    Recovery Distance (mi)
                    <input
                      value={block.recoveryDistanceMiles}
                      onChange={(event) => {
                        const nextBlocks = draft.workout.blocks.map((item) =>
                          item.id === block.id ? { ...item, recoveryDistanceMiles: event.target.value } : item
                        );
                        setDraft({ ...draft, workout: { ...draft.workout, blocks: nextBlocks } });
                      }}
                    />
                  </label>
                ) : (
                  <label>
                    Recovery Time (min)
                    <input
                      value={block.recoveryDurationMinutes}
                      onChange={(event) => {
                        const nextBlocks = draft.workout.blocks.map((item) =>
                          item.id === block.id ? { ...item, recoveryDurationMinutes: event.target.value } : item
                        );
                        setDraft({ ...draft, workout: { ...draft.workout, blocks: nextBlocks } });
                      }}
                    />
                  </label>
                )}
              </div>

              <p className="hint">Rep target: {repPaceLabel(vdot, block.repZone, block.repDistanceMiles)}</p>

              <button
                type="button"
                className="danger"
                onClick={() => {
                  const nextBlocks = draft.workout.blocks.filter((item) => item.id !== block.id);
                  setDraft({
                    ...draft,
                    workout: {
                      ...draft.workout,
                      blocks: nextBlocks.length > 0 ? nextBlocks : [makeBlockDraft()]
                    }
                  });
                }}
              >
                Remove Block
              </button>
            </fieldset>
          ))}

          <button
            type="button"
            onClick={() => {
              setDraft({
                ...draft,
                workout: {
                  ...draft.workout,
                  blocks: [...draft.workout.blocks, makeBlockDraft()]
                }
              });
            }}
          >
            Add Block
          </button>
        </section>
      )}

      <label>
        Notes
        <textarea
          rows={3}
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          placeholder="Optional notes"
        />
      </label>

      {errorMessage ? <p className="error-inline">{errorMessage}</p> : null}

      <div className="card-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel ? (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function DayDetailPanel({
  dateISO,
  workouts,
  activeVdot,
  resolveVdotForDate,
  onCreateWorkout,
  onUpdateWorkout,
  onSetStatus,
  onDeleteWorkout
}: DayDetailPanelProps) {
  const [createDraft, setCreateDraft] = useState<EntryDraft>(makeDefaultDraft(dateISO));
  const [createError, setCreateError] = useState("");

  const [editingWorkoutID, setEditingWorkoutID] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<EntryDraft | null>(null);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    setCreateDraft(makeDefaultDraft(dateISO));
  }, [dateISO]);

  const dayLabel = labelForDateISO(dateISO);

  return (
    <section className="detail-pane" aria-label="Day details pane">
      <header className="detail-header">
        <h2>{dayLabel}</h2>
        <p className="muted">
          Active VDOT: {activeVdot ? `${activeVdot.vdot} (effective ${activeVdot.effectiveDateISO})` : "Not set"}
        </p>
      </header>

      <section className="entry-section">
        <h3>New Entry</h3>
        <EntryForm
          draft={createDraft}
          setDraft={setCreateDraft}
          resolveVdotForDate={resolveVdotForDate}
          submitLabel="Save Entry"
          errorMessage={createError}
          onSubmit={async () => {
            const result = buildInputFromDraft(createDraft, resolveVdotForDate);
            if (result.error) {
              setCreateError(result.error);
              return;
            }

            await onCreateWorkout(result.input);
            setCreateError("");
            setCreateDraft(makeDefaultDraft(dateISO));
          }}
        />
      </section>

      <div className="workout-list">
        {workouts.length === 0 ? <p>No entries saved for this day.</p> : null}

        {workouts.map((workout) => {
          const isEditing = editingWorkoutID === workout.id && editingDraft !== null;

          return (
            <article className="workout-card" key={workout.id}>
              {!isEditing ? (
                <>
                  <div className="workout-card-header">
                    <h3>{workout.title}</h3>
                    <div className="card-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorkoutID(workout.id);
                          setEditingDraft(workoutToDraft(workout));
                          setEditError("");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={async () => {
                          await onDeleteWorkout(workout.id);
                          if (editingWorkoutID === workout.id) {
                            setEditingWorkoutID(null);
                            setEditingDraft(null);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <p className="meta">{workout.entryMode === "simpleRun" ? "Simple Run" : "Workout"}</p>
                  <p className="meta">{entrySummary(workout)}</p>

                  <label className="status-row">
                    Status
                    <select
                      aria-label={`Status for ${workout.title}`}
                      value={workout.status}
                      onChange={async (event) => {
                        await onSetStatus(workout.id, event.target.value as WorkoutStatus);
                      }}
                    >
                      <option value="planned">Planned</option>
                      <option value="completed">Completed</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  </label>
                </>
              ) : (
                <EntryForm
                  draft={editingDraft}
                  setDraft={setEditingDraft}
                  resolveVdotForDate={resolveVdotForDate}
                  submitLabel="Save Changes"
                  errorMessage={editError}
                  onSubmit={async () => {
                    const result = buildInputFromDraft(editingDraft, resolveVdotForDate);
                    if (result.error) {
                      setEditError(result.error);
                      return;
                    }

                    await onUpdateWorkout(workout.id, {
                      dateISO: result.input.dateISO,
                      title: result.input.title,
                      status: result.input.status,
                      notes: result.input.notes,
                      entryMode: result.input.entryMode,
                      simpleRun: result.input.simpleRun,
                      workout: result.input.workout
                    });

                    setEditingWorkoutID(null);
                    setEditingDraft(null);
                    setEditError("");
                  }}
                  onCancel={() => {
                    setEditingWorkoutID(null);
                    setEditingDraft(null);
                    setEditError("");
                  }}
                />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
