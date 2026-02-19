// DragContext — owns all shared drag state (shared values) and the layout registry.
// Every component reads from and writes to these values during a drag.
import * as React from "react";
import { useSharedValue, useAnimatedRef } from "react-native-reanimated";
import type Animated from "react-native-reanimated";
import { TaskItem } from "@/data";

// Shape of a single item layout entry stored in the registry
export type ItemLayout = {
  taskId: string;
  listId: string;
  pageY: number;          // Absolute screen Y at the moment measure() was called
  height: number;         // Rendered height of the item
  order: number;          // Current order within the list
  scrollYAtMeasure: number; // ScrollView offset when pageY was captured — used to
                            // correct for scroll that happened after the last measure
};

// Shape of a single list layout entry stored in the registry
export type ListLayout = {
  listId: string;
  pageY: number;          // Absolute screen Y at the moment measure() was called
  height: number;         // Rendered height of the list container
  scrollYAtMeasure: number; // ScrollView offset when pageY was captured
};

// Everything the drag engine and child components need, passed via context
export type DragContextValue = {
  // --- Drag identity ---
  isDragging: ReturnType<typeof useSharedValue<boolean>>;
  draggedTaskId: ReturnType<typeof useSharedValue<string | null>>;
  draggedFromListId: ReturnType<typeof useSharedValue<string | null>>;

  // --- Ghost position (absolute screen coordinates) ---
  ghostX: ReturnType<typeof useSharedValue<number>>;
  ghostY: ReturnType<typeof useSharedValue<number>>;
  ghostOriginX: ReturnType<typeof useSharedValue<number>>;
  ghostOriginY: ReturnType<typeof useSharedValue<number>>;
  ghostHeight: ReturnType<typeof useSharedValue<number>>;
  ghostWidth: ReturnType<typeof useSharedValue<number>>;

  // --- Drop target tracking ---
  activeDropListId: ReturnType<typeof useSharedValue<string | null>>;
  // Slot key: taskId of the item the dragged item will land BEFORE,
  // or "end:<listId>" when dropping after the last item.
  // Stored as a string so InsertionLine can match by item identity,
  // not by fragile index arithmetic that breaks as list order changes.
  activeDropSlot: ReturnType<typeof useSharedValue<string>>;

  // --- ScrollView control ---
  scrollEnabled: ReturnType<typeof useSharedValue<boolean>>;
  scrollViewRef: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>;
  currentScrollY: ReturnType<typeof useSharedValue<number>>;

  // --- Layout registry (updated by each TaskItem and TaskList on layout) ---
  itemLayouts: ReturnType<typeof useSharedValue<ItemLayout[]>>;
  listLayouts: ReturnType<typeof useSharedValue<ListLayout[]>>;

  // --- Ghost content (title/description to render inside the ghost) ---
  ghostTitle: ReturnType<typeof useSharedValue<string>>;
  ghostDescription: ReturnType<typeof useSharedValue<string>>;

  // --- State commit — called from RN thread after drop animation completes ---
  commitDrop: (
    sourceTaskId: string,
    sourceListId: string,
    targetListId: string,
    // Slot key set by hitTest: taskId of the item to insert BEFORE,
    // or "end:<listId>" when inserting after the last item.
    targetSlot: string,
  ) => void;
};

// The context — undefined until the provider mounts
const DragContext = React.createContext<DragContextValue | undefined>(undefined);

// Props for the provider — needs the setTasks updater from index.tsx
type DragProviderProps = {
  children: React.ReactNode;
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
};

/**
 * DragProvider wraps the whole screen and creates all shared values.
 * Pass setTasks down so commitDrop can update React state after a drop.
 */
export function DragProvider({ children, setTasks }: DragProviderProps) {
  // --- Drag identity ---
  const isDragging = useSharedValue(false);
  const draggedTaskId = useSharedValue<string | null>(null);
  const draggedFromListId = useSharedValue<string | null>(null);

  // --- Ghost absolute position on screen ---
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostOriginX = useSharedValue(0);
  const ghostOriginY = useSharedValue(0);
  const ghostHeight = useSharedValue(0);
  const ghostWidth = useSharedValue(0);

  // --- Drop target ---
  const activeDropListId = useSharedValue<string | null>(null);
  // Empty string = no active drop slot
  const activeDropSlot = useSharedValue("");

  // --- ScrollView ---
  const scrollEnabled = useSharedValue(true);
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
  const currentScrollY = useSharedValue(0);

  // --- Layout registry ---
  const itemLayouts = useSharedValue<ItemLayout[]>([]);
  const listLayouts = useSharedValue<ListLayout[]>([]);

  // --- Ghost display content ---
  const ghostTitle = useSharedValue("");
  const ghostDescription = useSharedValue("");

  /**
   * Commits a completed drop to React state.
   * Handles both same-list reorder and cross-list move in one atomic setTasks call.
   * Called from the RN thread via scheduleOnRN after the drop animation finishes.
   *
   * Uses the .order field (React state) as the source of truth for item ordering,
   * NOT pageY positions from the layout registry (which can be stale after reorders).
   * The targetSlot (taskId or "end:<listId>") was computed by hitTest on the UI thread
   * and identifies which item to insert before — this is always reliable because
   * hitTest uses live pageY values at the moment of the drop.
   */
  function commitDrop(
    sourceTaskId: string,
    sourceListId: string,
    targetListId: string,
    // Slot key from hitTest: taskId of item to insert BEFORE, or "end:<listId>"
    targetSlot: string,
  ) {
    setTasks((prevTasks) => {
      // Work on a shallow copy so we don't mutate state directly
      const updated = prevTasks.map((t) => ({ ...t }));

      // Sort tasks by their .order field — this is the canonical ordering
      // maintained by React state and always consistent with what was rendered.
      function byOrder(arr: typeof updated) {
        return arr.sort((a, b) => a.order - b.order);
      }

      if (sourceListId === targetListId) {
        // --- SAME-LIST REORDER ---
        // Get all tasks in the list except the dragged one, sorted by order
        const otherTasks = byOrder(
          updated.filter(
            (t) => t.listId === sourceListId && t.taskId !== sourceTaskId,
          ),
        );
        const dragged = updated.find((t) => t.taskId === sourceTaskId)!;

        // Find where to splice — the index of the item we insert before
        const isEnd = targetSlot === `end:${targetListId}`;
        const spliceAt = isEnd
          ? otherTasks.length
          : otherTasks.findIndex((t) => t.taskId === targetSlot);

        // If slot key is not found (stale reference), append at end
        const insertAt = spliceAt < 0 ? otherTasks.length : spliceAt;
        otherTasks.splice(insertAt, 0, dragged);

        // Write fresh sequential order values back to updated
        otherTasks.forEach((task, i) => {
          const idx = updated.findIndex((t) => t.taskId === task.taskId);
          updated[idx].order = i;
        });
      } else {
        // --- CROSS-LIST MOVE ---
        // 1. Move the dragged task to the target list
        const draggedGlobalIdx = updated.findIndex((t) => t.taskId === sourceTaskId);
        updated[draggedGlobalIdx].listId = targetListId;

        // 2. Re-index the source list (dragged item is now gone from it)
        const sourceRemaining = byOrder(
          updated.filter((t) => t.listId === sourceListId),
        );
        sourceRemaining.forEach((task, i) => {
          const idx = updated.findIndex((t) => t.taskId === task.taskId);
          updated[idx].order = i;
        });

        // 3. Build the target list without the dragged item, splice it in at
        //    the slot hitTest identified, then assign fresh sequential order values
        const targetExisting = byOrder(
          updated.filter(
            (t) => t.listId === targetListId && t.taskId !== sourceTaskId,
          ),
        );

        const isEnd = targetSlot === `end:${targetListId}`;
        const spliceAt = isEnd
          ? targetExisting.length
          : targetExisting.findIndex((t) => t.taskId === targetSlot);

        // If targetSlot key not found (stale), append at end
        const insertAt = spliceAt < 0 ? targetExisting.length : spliceAt;
        targetExisting.splice(insertAt, 0, updated[draggedGlobalIdx]);

        targetExisting.forEach((task, i) => {
          const idx = updated.findIndex((t) => t.taskId === task.taskId);
          updated[idx].order = i;
        });
      }

      return updated;
    });
  }

  const value: DragContextValue = {
    isDragging,
    draggedTaskId,
    draggedFromListId,
    ghostX,
    ghostY,
    ghostOriginX,
    ghostOriginY,
    ghostHeight,
    ghostWidth,
    activeDropListId,
    activeDropSlot,
    scrollEnabled,
    scrollViewRef,
    currentScrollY,
    itemLayouts,
    listLayouts,
    ghostTitle,
    ghostDescription,
    commitDrop,
  };

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

/**
 * useDragContext — consume the drag context from any child component.
 * Throws if used outside of DragProvider.
 */
export function useDragContext(): DragContextValue {
  const ctx = React.useContext(DragContext);
  if (!ctx) {
    throw new Error("useDragContext must be used inside DragProvider");
  }
  return ctx;
}
