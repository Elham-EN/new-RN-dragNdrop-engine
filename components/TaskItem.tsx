// TaskItem — a single draggable task row.
// Wraps its content in a GestureDetector with a long-press pan gesture.
// On pickup: positions the ghost, hides itself, disables scroll.
// While dragging: moves the ghost, hit-tests the layout registry each frame.
// On drop: commits state via scheduleOnRN, cleans up.
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
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

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
    activeDropSlot,
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
   * Hit-test: determines which list and slot the finger is over.
   *
   * Uses real layout positions (no phantom-space compensation) so the hit-test
   * midpoints match exactly where the InsertionLine components physically sit.
   * The dragged item is hidden but still occupies layout space — that's fine
   * because the InsertionLine wrappers also sit at those real positions.
   * The dragged item is excluded from midpoint comparisons so the finger
   * can pass through its phantom space and reach the items below.
   */
  function hitTest(fingerY: number) {
    "worklet";

    // Scroll offset right now — used to correct stale pageY entries
    const scrollNow = currentScrollY.value;

    // All registered item layouts — pageY values may be stale if the list scrolled
    const allItems = itemLayouts.value;

    // Helper: returns the live screen Y for an item by adjusting for scroll delta
    function livePageY(item: {
      pageY: number;
      scrollYAtMeasure: number;
    }): number {
      "worklet";
      const scrollDelta = scrollNow - item.scrollYAtMeasure;
      return item.pageY - scrollDelta;
    }

    const draggedId = draggedTaskId.value;

    // Use listLayouts for list boundary detection — includes header + items
    let foundListId: string | null = null;

    for (let i = 0; i < listLayouts.value.length; i++) {
      const layout = listLayouts.value[i];
      const layoutScrollDelta = scrollNow - layout.scrollYAtMeasure;
      const layoutTop = layout.pageY - layoutScrollDelta;
      const layoutBottom = layoutTop + layout.height;
      if (fingerY >= layoutTop && fingerY <= layoutBottom) {
        foundListId = layout.listId;
        break;
      }
    }

    activeDropListId.value = foundListId;

    if (foundListId === null) {
      activeDropSlot.value = "";
      return;
    }

    // Get all items in this list EXCEPT the dragged item, sorted by screen Y.
    // Excluding the dragged item means its phantom space becomes a "pass-through"
    // zone — the finger flows through it to reach adjacent item midpoints.
    const listItems = allItems
      .filter(
        (item) => item.listId === foundListId && item.taskId !== draggedId,
      )
      .sort((a, b) => livePageY(a) - livePageY(b));

    // Walk items top-to-bottom. The slot is "insert before" the first item
    // whose midpoint is below the finger. If the finger is past all midpoints
    // the slot is "end" (append after last item).
    let slot = `end:${foundListId}`;
    for (let j = 0; j < listItems.length; j++) {
      const itemMidY = livePageY(listItems[j]) + listItems[j].height / 2;
      if (fingerY < itemMidY) {
        slot = listItems[j].taskId;
        break;
      }
    }
    activeDropSlot.value = slot;
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

      // Register the initial drop slot using the finger's screen position.
      // absoluteY is not available in onStart, so use the ghost origin midpoint
      // as an approximation — the finger is on the item at this moment.
      hitTest(ghostOriginY.value + ghostHeight.value / 2);
    })

    .onUpdate((event) => {
      "worklet";
      // Move the ghost to follow the finger — origin + cumulative translation
      ghostX.value = ghostOriginX.value + event.translationX;
      ghostY.value = ghostOriginY.value + event.translationY;

      // Re-run hit-test every frame with the live finger position.
      // absoluteY is always the current absolute screen Y of the finger —
      // it matches pageY from measure() which is also in absolute screen space.
      hitTest(event.absoluteY);

      // Auto-scroll if the finger is near the top or bottom edge
      checkAutoScroll(event.absoluteY);
    })

    .onEnd(() => {
      "worklet";
      const targetListId = activeDropListId.value;
      const targetSlot = activeDropSlot.value;
      const sourceTaskId = draggedTaskId.value;
      const sourceListId = draggedFromListId.value;

      // Valid drop: we have a list target and a non-empty slot key
      if (
        targetListId !== null &&
        targetSlot !== "" &&
        sourceTaskId !== null &&
        sourceListId !== null
      ) {
        // Hide ghost immediately and commit the drop — React re-render will
        // place the item in its new position with the restored opacity.
        isDragging.value = false;
        scheduleOnRN(
          commitDrop,
          sourceTaskId,
          sourceListId,
          targetListId,
          targetSlot,
        );
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
      activeDropSlot.value = "";
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
          // Capture the current scroll offset so hitTest can correct for
          // any scroll that happens between now and when the item is hit-tested
          scrollYAtMeasure: currentScrollY.value,
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
