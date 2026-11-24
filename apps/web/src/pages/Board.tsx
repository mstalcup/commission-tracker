import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Business, Client, Commission, Stage } from '@ct/shared';
import { DueDate, Money } from '../components/commission-bits';
import { useNewCommission } from '../components/NewCommission';
import { Button, cx, ErrorNote, PageHeader, Spinner } from '../components/ui';
import { useBusiness, useClientMap, useCommissions, useUpdateCommission } from '../lib/queries';

export function Board() {
  const business = useBusiness();
  const commissions = useCommissions();
  const clients = useClientMap();
  const update = useUpdateCommission();
  const newCommission = useNewCommission();
  const [showArchived, setShowArchived] = useState(false);
  const [dragging, setDragging] = useState<Commission | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  if (commissions.isPending) return <Spinner />;
  if (commissions.isError) return <ErrorNote>{commissions.error.message}</ErrorNote>;

  const stages = business.stages.filter((s) => showArchived || s.kind !== 'archived');
  const byStage = new Map<string, Commission[]>(stages.map((s) => [s.id, []]));
  for (const c of commissions.data) byStage.get(c.stageId)?.push(c);

  function onDragStart(e: DragStartEvent) {
    setDragging(commissions.data?.find((c) => c.commissionId === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const stageId = e.over?.id as string | undefined;
    const c = commissions.data?.find((x) => x.commissionId === e.active.id);
    if (!stageId || !c || c.stageId === stageId) return;
    update.mutate({ id: c.commissionId, input: { stageId } });
  }

  return (
    <div>
      <PageHeader
        title="Stage board"
        subtitle="Drag a job to move it to the next stage."
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setShowArchived((x) => !x)}>
              {showArchived ? 'Hide declined/cancelled' : 'Show declined/cancelled'}
            </Button>
            <Link to="/settings#stages" className="self-center px-2 text-xs text-muted hover:text-ink">
              Edit stages
            </Link>
          </>
        }
      />
      {update.isError && <ErrorNote>Couldn’t move that job: {update.error.message}</ErrorNote>}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {stages.map((stage) => (
            <Column key={stage.id} stage={stage} items={byStage.get(stage.id) ?? []} business={business} clients={clients} onAdd={newCommission} />
          ))}
        </div>
        <DragOverlay>
          {dragging ? <CardBody c={dragging} business={business} client={clients.get(dragging.clientId ?? '')} lifted /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  stage,
  items,
  business,
  clients,
  onAdd,
}: {
  stage: Stage;
  items: Commission[];
  business: Business;
  clients: Map<string, Client>;
  onAdd: (stageId?: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      className={cx(
        'flex w-72 shrink-0 snap-start flex-col rounded-xl border bg-panel transition-colors',
        isOver ? 'border-accent bg-panel-2' : 'border-line',
      )}
    >
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
        <h2 className="text-sm font-semibold">{stage.name}</h2>
        <span className="ml-auto rounded-full bg-panel-2 px-2 text-xs text-muted">{items.length}</span>
      </header>
      <div className="flex min-h-32 flex-1 flex-col gap-2 p-2">
        {items.map((c) => (
          <DraggableCard key={c.commissionId} c={c} business={business} client={clients.get(c.clientId ?? '')} />
        ))}
        {stage.kind === 'request' && (
          <button onClick={() => onAdd(stage.id)} className="rounded-lg border border-dashed border-line py-2 text-xs text-muted hover:text-ink">
            + Add request
          </button>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ c, business, client }: { c: Commission; business: Business; client?: Client }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.commissionId });
  const navigate = useNavigate();
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => navigate(`/commissions/${c.commissionId}`)}
      className={cx('cursor-grab touch-manipulation active:cursor-grabbing', isDragging && 'opacity-30')}
    >
      <CardBody c={c} business={business} client={client} />
    </div>
  );
}

function CardBody({ c, business, client, lifted }: { c: Commission; business: Business; client?: Client; lifted?: boolean }) {
  return (
    <div className={cx('rounded-lg border border-line bg-bg p-3 text-left', lifted && 'rotate-2 border-accent shadow-2xl')}>
      <p className="text-sm font-medium leading-snug">{c.title}</p>
      {client && <p className="mt-0.5 text-xs text-muted">{client.name}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <DueDate business={business} commission={c} />
        <Money cents={c.priceCents} currency={business.currency} className="ml-auto text-xs font-semibold" />
      </div>
    </div>
  );
}
