import {
  type Announcements,
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type KeyboardEventHandler, type ReactNode, useMemo, useState } from "react";
import { buildColumns, type Columns } from "../domain/board";
import { formatItemKey } from "../domain/keys";
import type { Status, WorkItem } from "../domain/types";
import { STATUSES, STATUS_LABELS } from "../domain/workflow";
import { LabelChip, PriorityBadge } from "./Badges";
import { NoteCount } from "./NoteCount";

const STATUS_TINT: Record<Status, string> = {
  todo: "bg-tint-blue",
  in_progress: "bg-tint-yellow",
  in_review: "bg-tint-teal",
  done: "bg-tint-green",
};

interface BoardProps {
  projectKey: string;
  items: WorkItem[];
  noteCounts: Record<string, number>;
  onOpen(item: WorkItem): void;
  onMove(id: string, status: Status, index: number): void;
}

function isStatus(id: unknown): id is Status {
  return typeof id === "string" && (STATUSES as readonly string[]).includes(id);
}

export function Board({ projectKey, items, noteCounts, onOpen, onMove }: BoardProps) {
  const [draft, setDraft] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const columns = draft ?? buildColumns(items);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findContainer(cols: Columns, id: unknown): Status | undefined {
    if (isStatus(id)) return id;
    return STATUSES.find((s) => cols[s].includes(String(id)));
  }

  function label(id: unknown): string {
    const item = itemsById.get(String(id));
    return item ? `${formatItemKey(projectKey, item.number)} ${item.title}` : "item";
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
    onDragOver: ({ active, over }) => {
      const container = over && findContainer(columns, over.id);
      return container ? `${label(active.id)} is over ${STATUS_LABELS[container]}.` : undefined;
    },
    onDragEnd: ({ active, over }) => {
      const container = over && findContainer(columns, over.id);
      return container
        ? `Dropped ${label(active.id)} in ${STATUS_LABELS[container]}.`
        : `Dropped ${label(active.id)}.`;
    },
    onDragCancel: ({ active }) => `Cancelled moving ${label(active.id)}.`,
  };

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDraft(buildColumns(items));
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || !draft) return;
    const from = findContainer(draft, active.id);
    const to = findContainer(draft, over.id);
    if (!from || !to || from === to) return;

    // Moving into another column while dragging: show the card there right away.
    const target = draft[to];
    let index: number;
    if (isStatus(over.id)) {
      index = target.length;
    } else {
      const overIndex = target.indexOf(String(over.id));
      const translated = active.rect.current.translated;
      const below = translated ? translated.top > over.rect.top + over.rect.height : false;
      index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
    }
    setDraft({
      ...draft,
      [from]: draft[from].filter((id) => id !== String(active.id)),
      [to]: [...target.slice(0, index), String(active.id), ...target.slice(index)],
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const current = draft;
    setActiveId(null);
    setDraft(null);
    if (!current || !over) return;

    const id = String(active.id);
    const container = findContainer(current, id);
    if (!container) return;
    const overContainer = findContainer(current, over.id);

    let finalList = current[container];
    if (!isStatus(over.id) && over.id !== active.id && overContainer === container) {
      const from = finalList.indexOf(id);
      const to = finalList.indexOf(String(over.id));
      if (from >= 0 && to >= 0) finalList = arrayMove(finalList, from, to);
    }
    onMove(id, container, finalList.indexOf(id));
  }

  const activeItem = activeId ? itemsById.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDraft(null);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATUSES.map((status) => (
          <Column key={status} status={status} ids={columns[status]}>
            {columns[status].map((id) => {
              const item = itemsById.get(id);
              return item ? (
                <Card key={id} item={item} noteCount={noteCounts[id]} projectKey={projectKey} onOpen={onOpen} />
              ) : null;
            })}
          </Column>
        ))}
      </div>
      <DragOverlay>
        {activeItem && (
          <CardBody item={activeItem} noteCount={noteCounts[activeItem.id]} projectKey={projectKey} dragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  ids,
  children,
}: {
  status: Status;
  ids: string[];
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      aria-label={STATUS_LABELS[status]}
      className={`flex min-h-48 flex-col rounded-card p-3 shadow-sm transition-colors ${
        isOver ? "bg-tint-pink/40" : "bg-white"
      }`}
    >
      <div
        className={`mb-3 flex items-center justify-between rounded-md px-3 py-1.5 text-sm font-bold text-ink ${STATUS_TINT[status]}`}
      >
        {STATUS_LABELS[status]}
        <span>{ids.length}</span>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex-1 space-y-2">
          {children}
          {ids.length === 0 && <li className="px-1 text-sm">Drop items here</li>}
        </ul>
      </SortableContext>
    </section>
  );
}

function Card({
  item,
  noteCount,
  projectKey,
  onOpen,
}: {
  item: WorkItem;
  noteCount?: number;
  projectKey: string;
  onOpen(item: WorkItem): void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  // Pointer/touch drag from anywhere on the card; keyboard drag from the handle only,
  // so Enter on the title still opens the item.
  const { onKeyDown, ...pointerListeners } = listeners ?? {};

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-30" : undefined}
      {...pointerListeners}
    >
      <CardBody
        item={item}
        noteCount={noteCount}
        projectKey={projectKey}
        onOpen={onOpen}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            onKeyDown={onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined}
            {...attributes}
            aria-label={`Move ${formatItemKey(projectKey, item.number)}`}
            className="cursor-grab touch-none rounded px-1 text-brand-gray hover:bg-surface"
          >
            <span aria-hidden="true">⠿</span>
          </button>
        }
      />
    </li>
  );
}

function CardBody({
  item,
  noteCount,
  projectKey,
  onOpen,
  handle,
  dragging,
}: {
  item: WorkItem;
  noteCount?: number;
  projectKey: string;
  onOpen?(item: WorkItem): void;
  handle?: ReactNode;
  dragging?: boolean;
}) {
  return (
    <div
      className={`rounded-md border bg-white p-3 ${
        dragging ? "rotate-2 border-brand-red shadow-xl" : "border-line hover:border-brand-gray"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs font-bold">{formatItemKey(projectKey, item.number)}</span>
        {handle}
      </div>
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="mb-2 block text-left text-sm font-bold text-ink hover:text-brand-red"
        >
          {item.title}
        </button>
      ) : (
        <span className="mb-2 block text-sm font-bold text-ink">{item.title}</span>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <PriorityBadge priority={item.priority} />
        {item.labels.map((l) => (
          <LabelChip key={l} label={l} />
        ))}
        <span className="ml-auto">
          <NoteCount count={noteCount} />
        </span>
      </div>
    </div>
  );
}
