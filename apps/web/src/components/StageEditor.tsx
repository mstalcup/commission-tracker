import { useState } from 'react';
import { DEFAULT_STAGES, StagesSchema, type Business, type Stage, type StageKind } from '@ct/shared';
import { useUpdateBusiness } from '../lib/queries';
import { Button, ErrorNote } from './ui';

const KIND_LABELS: Record<StageKind, string> = {
  request: 'Request (not yet agreed)',
  open: 'Open job (in progress)',
  done: 'Done (delivered)',
  archived: 'Archived (declined/cancelled)',
};

function newId(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'stage';
  return `${slug}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Rename, recolor, reorder, add and remove stages. */
export function StageEditor({ business }: { business: Business }) {
  const update = useUpdateBusiness();
  const [stages, setStages] = useState<Stage[]>(business.stages);
  const [error, setError] = useState<string>();
  const dirty = JSON.stringify(stages) !== JSON.stringify(business.stages);

  const edit = (i: number, patch: Partial<Stage>) => setStages((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setStages((s) => {
      const next = [...s];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  async function save() {
    const r = StagesSchema.safeParse(stages);
    if (!r.success) return setError(r.error.issues[0]?.message);
    setError(undefined);
    try {
      await update.mutateAsync({ stages: r.data });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {stages.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg p-2">
            <input
              type="color"
              value={s.color}
              onChange={(e) => edit(i, { color: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
              aria-label={`${s.name} color`}
            />
            <input
              value={s.name}
              onChange={(e) => edit(i, { name: e.target.value })}
              className="min-w-32 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm"
              aria-label="Stage name"
              maxLength={40}
            />
            <select
              value={s.kind}
              onChange={(e) => edit(i, { kind: e.target.value as StageKind })}
              className="rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-muted"
              aria-label="Counts as"
            >
              {Object.entries(KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <div className="ml-auto flex gap-1">
              <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</Button>
              <Button type="button" size="sm" variant="ghost" disabled={i === stages.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setStages((x) => x.filter((_, j) => j !== i))} aria-label="Remove stage">✕</Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-faint">
        “Counts as” decides how a stage shows up on the dashboard: requests, open jobs, done, or hidden.
      </p>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setStages((s) => [...s, { id: newId('stage'), name: 'New stage', color: '#7aa2c9', kind: 'open' }])}>
          + Add stage
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setStages(business.stages)} disabled={!dirty}>
          Undo changes
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setStages(DEFAULT_STAGES)}>
          Reset to defaults
        </Button>
        <Button type="button" variant="primary" className="ml-auto" disabled={!dirty} busy={update.isPending} onClick={save}>
          Save stages
        </Button>
      </div>
    </div>
  );
}
