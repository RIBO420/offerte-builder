"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  UniqueIdentifier,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import type { DraggableAttributes } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { cn } from "@/lib/utils";
import { DragAnnouncements } from "./drag-handle";

// Default attributes for disabled/non-draggable items
const defaultAttributes: DraggableAttributes = {
  role: "button",
  tabIndex: 0,
  "aria-disabled": true,
  "aria-pressed": undefined,
  "aria-roledescription": "sortable",
  "aria-describedby": "",
};

export interface SortableItem {
  id: string | number;
  [key: string]: unknown;
}

export interface SortableListProps<T extends SortableItem> {
  /**
   * Array of items to render. Each item must have a unique `id` property.
   */
  items: T[];
  /**
   * Callback fired when items are reordered.
   * Receives the new array order.
   */
  onReorder: (items: T[]) => void;
  /**
   * Render function for each sortable item.
   * Receives the item, sortable props, and index.
   */
  renderItem: (
    item: T,
    sortableProps: SortableItemProps,
    index: number
  ) => React.ReactNode;
  /**
   * Optional render function for the drag overlay.
   * If not provided, the item will be rendered using renderItem.
   */
  renderDragOverlay?: (item: T) => React.ReactNode;
  /**
   * Additional class name for the list container
   */
  className?: string;
  /**
   * Whether to show a drop indicator line
   */
  showDropIndicator?: boolean;
  /**
   * Whether drag is disabled
   */
  disabled?: boolean;
  /**
   * Accessible label for the sortable list
   */
  "aria-label"?: string;
  /**
   * ID prefix for item accessibility
   */
  itemIdPrefix?: string;
  /**
   * When true, renders items without wrapper elements (for use in tables).
   * The renderItem function should handle its own refs and roles.
   */
  inline?: boolean;
}

export interface SortableItemProps {
  /**
   * Ref for the sortable item container
   */
  setNodeRef: (node: HTMLElement | null) => void;
  /**
   * Styles for transform and transition
   */
  style: React.CSSProperties;
  /**
   * Drag handle listeners (spread onto drag handle element)
   */
  listeners: DraggableSyntheticListeners;
  /**
   * Attributes for the drag handle (spread onto drag handle element)
   */
  attributes: DraggableAttributes;
  /**
   * Whether this item is currently being dragged
   */
  isDragging: boolean;
  /**
   * Whether another item is being dragged over this one
   */
  isOver: boolean;
  /**
   * Unique identifier for the item
   */
  id: UniqueIdentifier;
}

/**
 * Hook for creating a sortable item within a SortableList.
 * Use this when you need more control over the sortable item rendering.
 */
export function useSortableItem(id: UniqueIdentifier): SortableItemProps {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 1 : 0,
  };

  return {
    setNodeRef,
    style,
    listeners,
    attributes,
    isDragging,
    isOver,
    id,
  };
}

/**
 * A reusable sortable list component using @dnd-kit.
 * Supports keyboard navigation, touch, and pointer interactions.
 *
 * @example
 * ```tsx
 * const [items, setItems] = useState([
 *   { id: "1", name: "Item 1" },
 *   { id: "2", name: "Item 2" },
 * ]);
 *
 * <SortableList
 *   items={items}
 *   onReorder={setItems}
 *   renderItem={(item, sortableProps) => (
 *     <div ref={sortableProps.setNodeRef} style={sortableProps.style}>
 *       <DragHandle
 *         listeners={sortableProps.listeners}
 *         attributes={sortableProps.attributes}
 *         isDragging={sortableProps.isDragging}
 *       />
 *       {item.name}
 *     </div>
 *   )}
 * />
 * ```
 */
export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  renderDragOverlay,
  className,
  disabled = false,
  "aria-label": ariaLabel = "Herschikbare lijst",
  itemIdPrefix = "sortable-item",
  inline = false,
}: SortableListProps<T>) {
  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
  const [announcement, setAnnouncement] = React.useState<string>("");

  // Configure sensors for different input methods
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require 8px movement before starting drag (prevents accidental drags)
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeItem = React.useMemo(
    () => items.find((item) => item.id === activeId),
    [activeId, items]
  );

  const getItemPosition = (id: UniqueIdentifier) => {
    const index = items.findIndex((item) => item.id === id);
    return index + 1;
  };

  const getItemName = (id: UniqueIdentifier): string => {
    const item = items.find((item) => item.id === id);
    const name = item?.name as string | undefined;
    const taakNaam = item?.taakNaam as string | undefined;
    const omschrijving = item?.omschrijving as string | undefined;
    return name || taakNaam || omschrijving || `Item ${getItemPosition(id)}`;
  };

  // Accessibility announcement helpers
  const announceStart = (activeId: UniqueIdentifier) => {
    const position = getItemPosition(activeId);
    const name = getItemName(activeId);
    setAnnouncement(
      `${name} opgepakt op positie ${position} van ${items.length}. Gebruik pijltjestoetsen om te verplaatsen.`
    );
  };

  const announceMove = (activeId: UniqueIdentifier, overId: UniqueIdentifier) => {
    const activePosition = getItemPosition(activeId);
    const overPosition = getItemPosition(overId);
    const name = getItemName(activeId);
    setAnnouncement(
      `${name} verplaatst van positie ${activePosition} naar positie ${overPosition} van ${items.length}.`
    );
  };

  const announceEnd = (activeId: UniqueIdentifier, overId?: UniqueIdentifier) => {
    if (overId) {
      const finalPosition = getItemPosition(overId);
      const name = getItemName(activeId);
      setAnnouncement(`${name} neergezet op positie ${finalPosition} van ${items.length}.`);
    } else {
      setAnnouncement("Actie geannuleerd.");
    }
  };

  const announceCancel = (activeId: UniqueIdentifier) => {
    const name = getItemName(activeId);
    setAnnouncement(`${name} verplaatsing geannuleerd.`);
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
    announceStart(event.active.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);
    }

    announceEnd(active.id, over?.id);
    setActiveId(null);
  }

  function handleDragCancel(event: { active: { id: UniqueIdentifier } }) {
    announceCancel(event.active.id);
    setActiveId(null);
  }

  // Render disabled items (no drag functionality)
  const disabledItems = items.map((item, index) =>
    renderItem(
      item,
      {
        setNodeRef: () => {},
        style: {},
        listeners: undefined,
        attributes: defaultAttributes,
        isDragging: false,
        isOver: false,
        id: item.id,
      },
      index
    )
  );

  if (disabled) {
    // For inline mode (tables), render items directly without wrapper
    if (inline) {
      return <>{disabledItems}</>;
    }
    return (
      <div className={className} role="list" aria-label={ariaLabel}>
        {items.map((item, index) => (
          <div
            key={item.id}
            role="listitem"
            aria-label={`${getItemName(item.id)}, positie ${index + 1} van ${items.length}`}
          >
            {renderItem(
              item,
              {
                setNodeRef: () => {},
                style: {},
                listeners: undefined,
                attributes: defaultAttributes,
                isDragging: false,
                isOver: false,
                id: item.id,
              },
              index
            )}
          </div>
        ))}
      </div>
    );
  }

  // Render sortable items
  const sortableItems = items.map((item, index) => (
    <SortableListItem
      key={item.id}
      id={item.id}
      item={item}
      renderItem={renderItem}
      index={index}
      itemIdPrefix={itemIdPrefix}
      totalItems={items.length}
      getItemName={getItemName}
      inline={inline}
    />
  ));

  const content = (
    <SortableContext
      items={items.map((item) => item.id)}
      strategy={verticalListSortingStrategy}
    >
      {inline ? (
        // For inline mode (tables), render items directly without wrapper
        <>{sortableItems}</>
      ) : (
        <div className={className} role="list" aria-label={ariaLabel}>
          {sortableItems}
        </div>
      )}
    </SortableContext>
  );

  return (
    <>
      <DragAnnouncements>{announcement}</DragAnnouncements>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        {content}

        <DragOverlay>
          {activeItem && activeId !== null ? (
            <div className="opacity-90 shadow-lg">
              {renderDragOverlay
                ? renderDragOverlay(activeItem)
                : renderItem(
                    activeItem,
                    {
                      setNodeRef: () => {},
                      style: {},
                      listeners: undefined,
                      attributes: defaultAttributes,
                      isDragging: true,
                      isOver: false,
                      id: activeId,
                    },
                    items.findIndex((item) => item.id === activeId)
                  )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

interface SortableListItemProps<T extends SortableItem> {
  id: string | number;
  item: T;
  renderItem: (
    item: T,
    sortableProps: SortableItemProps,
    index: number
  ) => React.ReactNode;
  index: number;
  itemIdPrefix: string;
  totalItems: number;
  getItemName: (id: UniqueIdentifier) => string;
  inline?: boolean;
}

function SortableListItem<T extends SortableItem>({
  id,
  item,
  renderItem,
  index,
  itemIdPrefix,
  totalItems,
  getItemName,
  inline = false,
}: SortableListItemProps<T>) {
  const sortableProps = useSortableItem(id);

  // For inline mode (tables), render the item directly without wrapper div
  if (inline) {
    return <>{renderItem(item, sortableProps, index)}</>;
  }

  return (
    <div
      role="listitem"
      id={`${itemIdPrefix}-${id}`}
      aria-label={`${getItemName(id)}, positie ${index + 1} van ${totalItems}`}
      aria-describedby={sortableProps.isDragging ? "drag-instructions" : undefined}
    >
      {renderItem(item, sortableProps, index)}
    </div>
  );
}

/**
 * Wrapper component for sortable item content.
 * Provides consistent styling for sortable items.
 */
export function SortableItemWrapper({
  children,
  sortableProps,
  className,
}: {
  children: React.ReactNode;
  sortableProps: SortableItemProps;
  className?: string;
}) {
  return (
    <div
      ref={sortableProps.setNodeRef}
      style={sortableProps.style}
      className={cn(
        "transition-colors",
        sortableProps.isDragging && "bg-accent/50 rounded-md",
        sortableProps.isOver && "bg-accent/30",
        className
      )}
    >
      {children}
    </div>
  );
}

export { arrayMove };
