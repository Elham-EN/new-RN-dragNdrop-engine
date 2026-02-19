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
  pageY: number;   // Absolute Y position of the item on screen
  height: number;  // Rendered height of the item
  order: number;   // Current order within the list
};

// Shape of a single list layout entry stored in the registry
export type ListLayout = {
  listId: string;
  pageY: number;   // Absolute Y position of the list container on screen
  height: number;  // Rendered height of the list container
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
  activeDropIndex: ReturnType<typeof useSharedValue<number>>;

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
    targetIndex: number,
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
  const activeDropIndex = useSharedValue(-1);

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
   */
  function commitDrop(
    sourceTaskId: string,
    sourceListId: string,
    targetListId: string,
    targetIndex: number,
  ) {
    setTasks((prevTasks) => {
      // Work on a shallow copy so we don't mutate state directly
      const updated = prevTasks.map((t) => ({ ...t }));

      if (sourceListId === targetListId) {
        // --- SAME-LIST REORDER ---
        // Get the tasks for this list in their current order
        const listTasks = updated
          .filter((t) => t.listId === sourceListId)
          .sort((a, b) => a.order - b.order);

        // Pull the dragged task out
        const dragged = listTasks.find((t) => t.taskId === sourceTaskId)!;
        const rest = listTasks.filter((t) => t.taskId !== sourceTaskId);

        // Insert at the new position
        rest.splice(targetIndex, 0, dragged);

        // Write fresh order values back into the updated array
        rest.forEach((task, i) => {
          const idx = updated.findIndex((t) => t.taskId === task.taskId);
          updated[idx].order = i;
        });
      } else {
        // --- CROSS-LIST MOVE ---
        // 1. Move the task to the target list
        const draggedIdx = updated.findIndex((t) => t.taskId === sourceTaskId);
        updated[draggedIdx].listId = targetListId;

        // 2. Re-index source list — close the gap left by the removed task
        const sourceRemaining = updated
          .filter((t) => t.listId === sourceListId)
          .sort((a, b) => a.order - b.order);
        sourceRemaining.forEach((task, i) => {
          const idx = updated.findIndex((t) => t.taskId === task.taskId);
          updated[idx].order = i;
        });

        // 3. Re-index target list — insert dragged at targetIndex, shift others
        const targetAll = updated
          .filter((t) => t.listId === targetListId)
          .sort((a, b) => a.order - b.order);

        // Remove the dragged from wherever it landed in the sorted array
        const withoutDragged = targetAll.filter((t) => t.taskId !== sourceTaskId);
        // Insert at the requested position
        withoutDragged.splice(targetIndex, 0, updated[draggedIdx]);

        // Write clean order values for the whole target list
        withoutDragged.forEach((task, i) => {
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
    activeDropIndex,
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
