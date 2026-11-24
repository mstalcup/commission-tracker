import { z } from 'zod';

/**
 * Every stage has a "kind" so the app knows how to count it, no matter what the
 * user renames it to:
 *  - request:  new inquiry, not yet agreed (counts as a "commission request")
 *  - open:     agreed, being worked on (counts as an "open job")
 *  - done:     delivered / complete
 *  - archived: declined / cancelled (hidden from the board by default)
 */
export const STAGE_KINDS = ['request', 'open', 'done', 'archived'] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export const StageSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, 'Stage name is required').max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #4fa37a'),
  kind: z.enum(STAGE_KINDS),
});
export type Stage = z.infer<typeof StageSchema>;

export const DEFAULT_STAGES: Stage[] = [
  { id: 'new', name: 'New request', color: '#a3aaa6', kind: 'request' },
  { id: 'quoted', name: 'Quoted', color: '#b4a3e0', kind: 'open' },
  { id: 'in-progress', name: 'In progress', color: '#4fa37a', kind: 'open' },
  { id: 'finishing', name: 'Finishing', color: '#d9c46a', kind: 'open' },
  { id: 'delivered', name: 'Delivered', color: '#d5dcd8', kind: 'done' },
  { id: 'declined', name: 'Declined', color: '#6b6f6d', kind: 'archived' },
  { id: 'cancelled', name: 'Cancelled', color: '#5a5e5c', kind: 'archived' },
];

export const StagesSchema = z
  .array(StageSchema)
  .min(1)
  .max(20)
  .refine((s) => new Set(s.map((x) => x.id)).size === s.length, 'Stage ids must be unique')
  .refine((s) => s.some((x) => x.kind === 'request'), 'At least one stage must be a "request" stage');

export function stageById(stages: Stage[], id: string): Stage | undefined {
  return stages.find((s) => s.id === id);
}

/** The stage new commissions land in (first "request" stage). */
export function firstRequestStage(stages: Stage[]): Stage {
  return stages.find((s) => s.kind === 'request') ?? stages[0];
}
