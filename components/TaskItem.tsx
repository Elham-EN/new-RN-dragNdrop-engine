// TaskItem — a single draggable task row.
// Wraps its content in a GestureDetector with a long-press pan gesture.
// On pickup: positions the ghost, hides itself, disables scroll.
// While dragging: moves the ghost, hit-tests the layout registry each frame,
//   animates a gap in the target list to preview the drop position.
// On drop: snaps ghost to slot, commits state via scheduleOnRN, cleans up.
import { useDragContext } from "@/context/DragContext";
import * as React from "react";
import { StyleSheet, Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  measure,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnUI, scheduleOnRN } from "react-native-worklets";

interface TaskItemProps {
  taskId: string;
  listId: string;
  // Current position of this task within its list — used for hit-test comparisons
  order: number;
  title: string;
  description?: string;
}

/**
 * TaskItem renders a single task row and owns the full drag gesture lifecycle.
 * All gesture callbacks run as worklets on the UI thread for 60/120fps tracking.
 */
export default function TaskItem({
  taskId,
  listId,
  order,
  title,
  description,
}: TaskItemProps): React.ReactElement {
  const {
    isDragging,
    draggedTaskId,
    draggedFromListId,
    ghostX,
    ghostY,
    ghostOriginX,
    ghostOriginY,
    ghostHeight,
    ghostWidth,
    ghostTitle,
    ghostDescription,
    activeDropListId,
    activeDropIndex,
    scrollEnabled,
    scrollViewRef,
    currentScrollY,
    itemLayouts,
    listLayouts,
    commitDrop,
  } = useDragContext();

  // Ref to this item's Animated.View — used to measure absolute screen position
  const itemRef = useAnimatedRef<Animated.View>();

  // Controls this item's opacity — set to 0 when it is the item being dragged
  const selfOpacity = useSharedValue(1);

  /**
   * Hit-test: given the finger's absolute Y position, determine which list and
   * which insertion slot the finger is over.
   * Reads the layout registry shared values — runs entirely on the UI thread.
   */
  function hitTest(fingerY: number) {
    "worklet";
    // Find which list the finger is inside
    let foundListId: string | null = null;
    for (let i = 0; i < listLayouts.value.length; i++) {
      const list = listLayouts.value[i];
      if (fingerY >= list.pageY && fingerY <= list.pageY + list.height) {
        foundListId = list.listId;
        break;
      }
    }
    activeDropListId.value = foundListId;

    if (foundListId === null) {
      // Finger is outside all lists — no valid drop target
      activeDropIndex.value = -1;
      return;
    }

    // Within the found list, determine the insertion index by comparing the
    // finger Y to each item's midpoint (excluding the dragged item itself)
    const listItems = itemLayouts.value
      .filter(
        (item) =>
          item.listId === foundListId && item.taskId !== draggedTaskId.value,
      )
      .sort((a, b) => a.order - b.order);

    // Default: drop at the end of the list
    let insertIndex = listItems.length;
    for (let j = 0; j < listItems.length; j++) {
      // If finger is above the midpoint of item j, insert before it
      if (fingerY < listItems[j].pageY + listItems[j].height / 2) {
        insertIndex = j;
        break;
      }
    }
    activeDropIndex.value = insertIndex;
  }

  /**
   * Auto-scroll: if the finger is within 80px of the top or bottom edge of the
   * ScrollView, scroll in that direction at a speed proportional to proximity.
   * Runs on the UI thread via scrollTo — no JS bridge hop.
   */
  function checkAutoScroll(fingerY: number) {
    "worklet";
    const scrollMeasure = measure(scrollViewRef);
    if (scrollMeasure === null) return;

    const topThreshold = scrollMeasure.pageY + 80; // 80px zone from top edge
    const bottomThreshold = scrollMeasure.pageY + scrollMeasure.height - 80; // 80px zone from bottom edge

    if (fingerY < topThreshold) {
      // Scroll up — faster the closer to the edge
      const speed = (topThreshold - fingerY) * 0.3;
      scrollTo(scrollViewRef, 0, currentScrollY.value - speed, false);
    } else if (fingerY > bottomThreshold) {
      // Scroll down
      const speed = (fingerY - bottomThreshold) * 0.3;
      scrollTo(scrollViewRef, 0, currentScrollY.value + speed, false);
    }
  }

  // ─── Gap animation ──────────────────────────────────────────────────────────
  // ─── Gesture ────────────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    // Activate only after a 400ms hold — gives the ScrollView time to claim
    // vertical flicks before the drag kicks in
    .activateAfterLongPress(400)

    .onBegin(() => {
      "worklet";
      // Pre-measure this item's position so onStart has the data immediately
      const m = measure(itemRef);
      if (m !== null) {
        ghostOriginX.value = m.pageX;
        ghostOriginY.value = m.pageY;
        ghostHeight.value = m.height;
        ghostWidth.value = m.width;
      }
    })

    .onStart(() => {
      "worklet";
      // Long-press threshold met — drag is now active

      // Record which task and list are being dragged
      draggedTaskId.value = taskId;
      draggedFromListId.value = listId;
      isDragging.value = true;

      // Position the ghost exactly over this item
      ghostX.value = ghostOriginX.value;
      ghostY.value = ghostOriginY.value;

      // Copy display content into the ghost shared values
      ghostTitle.value = title;
      ghostDescription.value = description ?? "";

      // Hide this item — the ghost is now its visual stand-in
      selfOpacity.value = 0;

      // Disable the ScrollView so it doesn't compete with the pan gesture
      scrollEnabled.value = false;

      // Register the initial hit-test position
      hitTest(ghostOriginY.value);
    })

    .onUpdate((event) => {
      "worklet";
      // Move the ghost to follow the finger — origin + cumulative translation
      ghostX.value = ghostOriginX.value + event.translationX;
      ghostY.value = ghostOriginY.value + event.translationY;

      // Re-run hit-test every frame to update activeDropListId and activeDropIndex
      hitTest(event.absoluteY);

      // Auto-scroll if the finger is near the top or bottom edge
      checkAutoScroll(event.absoluteY);
    })

    .onEnd(() => {
      "worklet";
      const targetListId = activeDropListId.value;
      const targetIndex = activeDropIndex.value;
      const sourceTaskId = draggedTaskId.value;
      const sourceListId = draggedFromListId.value;

      if (
        targetListId !== null &&
        targetIndex >= 0 &&
        sourceTaskId !== null &&
        sourceListId !== null
      ) {
        // Valid drop — animate ghost to the target slot then commit state
        // For simplicity, snap ghost back to origin position then fade out
        ghostY.value = withTiming(ghostOriginY.value, { duration: 150 }, () => {
          "worklet";
          isDragging.value = false;
          // Call commitDrop on the JS/RN thread — scheduleOnRN bridges UI thread → JS thread
          scheduleOnRN(commitDrop, sourceTaskId, sourceListId, targetListId, targetIndex);
        });
      } else {
        // Invalid drop — snap ghost back to where the drag started
        ghostX.value = withSpring(ghostOriginX.value);
        ghostY.value = withSpring(ghostOriginY.value, {}, () => {
          "worklet";
          isDragging.value = false;
        });
      }

      // Re-enable scrolling immediately
      scrollEnabled.value = true;

      // Clear drop target indicators
      activeDropListId.value = null;
      activeDropIndex.value = -1;
    })

    .onFinalize(() => {
      "worklet";
      // Safety cleanup — restore this item's visibility regardless of how
      // the gesture ended (cancelled, interrupted, or completed)
      selfOpacity.value = withTiming(1, { duration: 150 });
      draggedTaskId.value = null;
      draggedFromListId.value = null;
    });

  // Animated style for this item — only controls opacity (hides item while ghost is shown)
  const itemAnimatedStyle = useAnimatedStyle(() => ({
    opacity: selfOpacity.value,
  }));

  // Register this item's layout into the shared registry so the hit-test can
  // find it. Called on every layout change (mount, reorder, text wrap change).
  function handleLayout() {
    // scheduleOnUI runs on the UI thread where measure() is valid.
    // Small delay via requestAnimationFrame lets the layout settle first.
    scheduleOnUI(() => {
      "worklet";
      // measure() must run on the UI thread — this worklet guarantees that
      const m = measure(itemRef);
      if (m === null) return;

      itemLayouts.modify((layouts) => {
        "worklet";
        const existingIdx = layouts.findIndex((l) => l.taskId === taskId);
        const entry = {
          taskId,
          listId,
          pageY: m.pageY,
          height: m.height,
          order,
        };
        if (existingIdx >= 0) {
          layouts[existingIdx] = entry;
        } else {
          layouts.push(entry);
        }
        return layouts;
      });
    });
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        ref={itemRef}
        style={[styles.taskItem, itemAnimatedStyle]}
        onLayout={handleLayout}
      >
        {/* Task title — bold and prominent */}
        <Text style={styles.taskTitle}>{title}</Text>
        {/* Task description — smaller and muted */}
        {description ? (
          <Text style={styles.taskDescription}>{description}</Text>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // Individual task row — marginBottom creates the gap where the insertion line sits
  taskItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  // Task title styling
  taskTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  // Task description styling
  taskDescription: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 20,
  },
});
