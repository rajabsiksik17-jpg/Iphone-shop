"use client";

import { useId, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, rectSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible drag-and-drop ordering (mouse, touch with a short press delay so
 * scrolling still works on phones, and keyboard: Space + arrows).
 */
export function SortableList<T>({ items, getId, onChange, render, layout = "list", className }: { items: T[]; getId: (item: T) => string; onChange: (items: T[]) => void; render: (item: T, handle: ReactNode, index: number) => ReactNode; layout?: "list" | "grid"; className?: string }) {
  // Stable id: dnd-kit's own counter differs between server and client render (hydration mismatch).
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => getId(i) === e.active.id);
    const to = items.findIndex((i) => getId(i) === e.over!.id);
    onChange(arrayMove(items, from, to));
  };
  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map(getId)} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, i) => (
            <SortableItem key={getId(item)} id={getId(item)}>
              {(handle) => render(item, handle, i)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button type="button" {...attributes} {...listeners} className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ad-muted hover:bg-ad-hover active:cursor-grabbing" aria-label="Drag to reorder">
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("relative", isDragging && "z-10 opacity-80 shadow-pop")}>
      {children(handle)}
    </div>
  );
}
