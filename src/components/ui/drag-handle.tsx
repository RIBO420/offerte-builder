"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraggableSyntheticListeners, DraggableAttributes } from "@dnd-kit/core";

export interface DragHandleProps extends React.HTMLAttributes<HTMLButtonElement> {
  /**
   * Whether the drag handle is currently being used/active
   */
  isDragging?: boolean;
  /**
   * Accessible label for screen readers
   */
  "aria-label"?: string;
  /**
   * Additional listeners for dnd-kit sortable
   */
  listeners?: DraggableSyntheticListeners;
  /**
   * Additional attributes for dnd-kit sortable
   */
  attributes?: DraggableAttributes;
}

/**
 * A drag handle component for use with sortable lists.
 * Provides visual and accessible affordances for drag-and-drop reordering.
 *
 * @example
 * // With @dnd-kit/sortable
 * const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
 *
 * <DragHandle
 *   listeners={listeners}
 *   attributes={attributes}
 *   isDragging={isDragging}
 *   aria-label="Versleep om te herschikken"
 * />
 */
export const DragHandle = React.forwardRef<HTMLButtonElement, DragHandleProps>(
  (
    {
      className,
      isDragging = false,
      listeners,
      attributes,
      "aria-label": ariaLabel = "Versleep om te herschikken",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          // Base styles
          "flex items-center justify-center",
          "h-9 w-9 sm:h-8 sm:w-8",
          "rounded-md",
          "text-muted-foreground",
          // Touch target sizing for mobile
          "touch-manipulation",
          // Hover & focus states
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Cursor states
          isDragging ? "cursor-grabbing" : "cursor-grab",
          // Active/dragging state
          isDragging && "bg-accent text-accent-foreground shadow-md",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        aria-label={ariaLabel}
        aria-describedby={isDragging ? "drag-instructions" : undefined}
        {...attributes}
        {...listeners}
        {...props}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
        {/* Hidden instructions for screen readers */}
        <span className="sr-only">
          {isDragging
            ? "Item wordt versleept. Gebruik pijltjestoetsen om te verplaatsen. Druk op Enter om te plaatsen of Escape om te annuleren."
            : "Druk op spatie of Enter om te beginnen met slepen. Gebruik pijltjestoetsen om te verplaatsen."}
        </span>
      </button>
    );
  }
);

DragHandle.displayName = "DragHandle";

/**
 * Hidden live region for screen reader announcements during drag operations.
 * Should be placed once in the DOM, typically near the sortable list.
 */
export function DragAnnouncements({ children }: { children?: React.ReactNode }) {
  return (
    <div
      id="drag-instructions"
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </div>
  );
}
