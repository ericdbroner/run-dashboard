import { useMemo, useState } from "react";
import { todayISO } from "../lib/date";
import { MAX_VDOT, MIN_VDOT } from "../lib/vdotChart";
import type { VdotProfile } from "../types/planner";

interface VdotManagerProps {
  profiles: VdotProfile[];
  onCreate: (input: { effectiveDateISO: string; vdot: number }) => Promise<void>;
  onUpdate: (id: string, patch: { effectiveDateISO: string; vdot: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function vdotOptions(): number[] {
  return Array.from({ length: MAX_VDOT - MIN_VDOT + 1 }, (_, index) => MIN_VDOT + index);
}

function VdotRowEditor({
  profile,
  onUpdate,
  onDelete
}: {
  profile: VdotProfile;
  onUpdate: (id: string, patch: { effectiveDateISO: string; vdot: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [effectiveDateISO, setEffectiveDateISO] = useState(profile.effectiveDateISO);
  const [vdot, setVdot] = useState(profile.vdot);

  return (
    <div className="vdot-row" key={profile.id}>
      <input type="date" value={effectiveDateISO} onChange={(event) => setEffectiveDateISO(event.target.value)} />
      <select value={vdot} onChange={(event) => setVdot(Number(event.target.value))}>
        {vdotOptions().map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={async () => {
          await onUpdate(profile.id, { effectiveDateISO, vdot });
        }}
      >
        Save
      </button>
      <button type="button" className="danger" onClick={async () => onDelete(profile.id)}>
        Delete
      </button>
    </div>
  );
}

export function VdotManager({ profiles, onCreate, onUpdate, onDelete }: VdotManagerProps) {
  const [newDateISO, setNewDateISO] = useState(() => todayISO());
  const [newVdot, setNewVdot] = useState(45);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => b.effectiveDateISO.localeCompare(a.effectiveDateISO)),
    [profiles]
  );

  return (
    <section className="vdot-panel" aria-label="VDOT profiles">
      <h2>VDOT Profiles</h2>
      <p>VDOT is resolved by date using the latest effective profile on or before the workout date.</p>

      <div className="vdot-row">
        <input type="date" value={newDateISO} onChange={(event) => setNewDateISO(event.target.value)} />
        <select value={newVdot} onChange={(event) => setNewVdot(Number(event.target.value))}>
          {vdotOptions().map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={async () => {
            await onCreate({ effectiveDateISO: newDateISO, vdot: newVdot });
          }}
        >
          Add VDOT
        </button>
      </div>

      {sortedProfiles.length === 0 ? <p className="muted">No VDOT profile set yet.</p> : null}

      {sortedProfiles.map((profile) => (
        <VdotRowEditor key={profile.id} profile={profile} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </section>
  );
}
