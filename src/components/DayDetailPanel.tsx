import { useMemo, useState } from "react";
import { labelForDateISO } from "../lib/date";
import type { CreateWorkoutInput, Template, UpdateWorkoutInput, Workout, WorkoutStatus, WorkoutType } from "../types/planner";

interface DayDetailPanelProps {
  dateISO: string;
  workouts: Workout[];
  templates: Template[];
  onCreateFromTemplate: (input: CreateWorkoutInput) => Promise<void>;
  onUpdateWorkout: (id: string, patch: UpdateWorkoutInput) => Promise<void>;
  onSetStatus: (id: string, status: WorkoutStatus) => Promise<void>;
  onDeleteWorkout: (id: string) => Promise<void>;
}

const WORKOUT_TYPE_OPTIONS: WorkoutType[] = [
  "easy",
  "recovery",
  "longRun",
  "threshold",
  "tempo",
  "vo2",
  "hills",
  "strides",
  "race",
  "rest"
];

function typeLabel(type: WorkoutType): string {
  const labels: Record<WorkoutType, string> = {
    easy: "Easy",
    recovery: "Recovery",
    longRun: "Long Run",
    threshold: "Threshold",
    tempo: "Tempo",
    vo2: "VO2",
    hills: "Hills",
    strides: "Strides",
    race: "Race",
    rest: "Rest"
  };

  return labels[type];
}

function statusLabel(status: WorkoutStatus): string {
  const labels: Record<WorkoutStatus, string> = {
    planned: "Planned",
    completed: "Completed",
    skipped: "Skipped"
  };

  return labels[status];
}

interface WorkoutEditorState {
  dateISO: string;
  title: string;
  type: WorkoutType;
  distanceMiles: string;
  durationMinutes: string;
  notes: string;
}

function workoutToEditorState(workout: Workout): WorkoutEditorState {
  return {
    dateISO: workout.dateISO,
    title: workout.title,
    type: workout.type,
    distanceMiles: workout.distanceMiles?.toString() ?? "",
    durationMinutes: workout.durationMinutes?.toString() ?? "",
    notes: workout.notes ?? ""
  };
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function createFromTemplate(template: Template, dateISO: string): CreateWorkoutInput {
  return {
    dateISO,
    title: template.defaultTitle ?? template.label,
    type: template.type,
    distanceMiles: template.defaultDistanceMiles,
    durationMinutes: template.defaultDurationMinutes,
    notes: template.defaultNotes
  };
}

export function DayDetailPanel({
  dateISO,
  workouts,
  templates,
  onCreateFromTemplate,
  onUpdateWorkout,
  onSetStatus,
  onDeleteWorkout
}: DayDetailPanelProps) {
  const [selectedTemplateID, setSelectedTemplateID] = useState<string>("");
  const [editingWorkoutID, setEditingWorkoutID] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<WorkoutEditorState | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateID) ?? templates[0],
    [selectedTemplateID, templates]
  );

  const dayLabel = labelForDateISO(dateISO);

  return (
    <section className="detail-pane" aria-label="Day details pane">
      <header>
        <h2>{dayLabel}</h2>
      </header>

      <div className="template-row">
        <label htmlFor="template-select">Template</label>
        <select
          id="template-select"
          value={selectedTemplateID || selectedTemplate?.id || ""}
          onChange={(event) => setSelectedTemplateID(event.target.value)}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedTemplate}
          onClick={async () => {
            if (!selectedTemplate) {
              return;
            }

            await onCreateFromTemplate(createFromTemplate(selectedTemplate, dateISO));
          }}
        >
          Add Workout from Template
        </button>
      </div>

      <div className="workout-list">
        {workouts.length === 0 ? <p>No workouts planned for this day.</p> : null}

        {workouts.map((workout) => {
          const isEditing = editingWorkoutID === workout.id && editorState !== null;

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
                          setEditorState(workoutToEditorState(workout));
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
                            setEditorState(null);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <p className="meta">{typeLabel(workout.type)}</p>
                  <p className="meta">
                    {workout.distanceMiles ? `${workout.distanceMiles} mi` : "No distance"} •{" "}
                    {workout.durationMinutes ? `${workout.durationMinutes} min` : "No duration"}
                  </p>
                  {workout.notes ? <p>{workout.notes}</p> : null}

                  <label className="status-row">
                    Status
                    <select
                      aria-label={`Status for ${workout.title}`}
                      value={workout.status}
                      onChange={async (event) => {
                        await onSetStatus(workout.id, event.target.value as WorkoutStatus);
                      }}
                    >
                      {(["planned", "completed", "skipped"] as WorkoutStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <form
                  className="editor-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!editorState) {
                      return;
                    }

                    await onUpdateWorkout(workout.id, {
                      dateISO: editorState.dateISO,
                      title: editorState.title,
                      type: editorState.type,
                      distanceMiles: parseOptionalNumber(editorState.distanceMiles),
                      durationMinutes: parseOptionalNumber(editorState.durationMinutes),
                      notes: editorState.notes
                    });

                    setEditingWorkoutID(null);
                    setEditorState(null);
                  }}
                >
                  <label>
                    Title
                    <input
                      value={editorState.title}
                      onChange={(event) =>
                        setEditorState((current) => (current ? { ...current, title: event.target.value } : current))
                      }
                    />
                  </label>

                  <label>
                    Date
                    <input
                      type="date"
                      value={editorState.dateISO}
                      onChange={(event) =>
                        setEditorState((current) => (current ? { ...current, dateISO: event.target.value } : current))
                      }
                    />
                  </label>

                  <label>
                    Type
                    <select
                      value={editorState.type}
                      onChange={(event) =>
                        setEditorState((current) =>
                          current ? { ...current, type: event.target.value as WorkoutType } : current
                        )
                      }
                    >
                      {WORKOUT_TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {typeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Distance (mi)
                    <input
                      value={editorState.distanceMiles}
                      onChange={(event) =>
                        setEditorState((current) =>
                          current ? { ...current, distanceMiles: event.target.value } : current
                        )
                      }
                    />
                  </label>

                  <label>
                    Duration (min)
                    <input
                      value={editorState.durationMinutes}
                      onChange={(event) =>
                        setEditorState((current) =>
                          current ? { ...current, durationMinutes: event.target.value } : current
                        )
                      }
                    />
                  </label>

                  <label>
                    Notes
                    <textarea
                      rows={3}
                      value={editorState.notes}
                      onChange={(event) =>
                        setEditorState((current) => (current ? { ...current, notes: event.target.value } : current))
                      }
                    />
                  </label>

                  <div className="card-actions">
                    <button type="submit">Save</button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWorkoutID(null);
                        setEditorState(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
