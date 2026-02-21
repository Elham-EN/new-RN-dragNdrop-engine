// DragList — collapsible list of draggable items. Registers its screen position
// into the drag context layout registry so the hit-test worklet knows where each
// list lives. Renders blue insertion lines between items to preview the drop position.
import { useDragContext } from "./DragContext";
import { DragItem } from "./types";
import DragItemComponent from "./DragItemComponent";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";

// Props for the DragList component
interface DragListProps {
  listId: string; // Unique identifier for this list
  listName: string; // Display name shown in the list header
  listIconLeft: React.ReactNode; // Icon element rendered to the left of the list name
  // Pre-filtered and sorted items for this list — supplied by parent state
  tasks: DragItem[];
}

// ─── InsertionLine ────────────────────────────────────────────────────────────
// A thin blue horizontal rule that appears at the active drop slot.
// Each line owns a slotKey: the taskId of the item directly below it,
// or "end:<listId>" for the slot after the last item. This matches
// exactly what hitTest writes into activeDropSlot — no index arithmetic needed.
interface InsertionLineProps {
  slotKey: string; // taskId to insert before, or "end:<listId>"
  listId: string; // The list this line belongs to
  isExpanded: boolean; // Hide entirely when list is collapsed
}

/**
 * InsertionLine renders a 3px blue bar that appears at the active drop slot.
 * Matches by slotKey (taskId identity) so it is always accurate regardless
 * of how many items are in the list or how order values have changed.
 */
function InsertionLine({ slotKey, listId, isExpanded }: InsertionLineProps) {
  const { activeDropListId, activeDropSlot, isDragging } = useDragContext();

  // Animated opacity — visible only when this slot is the active drop target
  const barStyle = useAnimatedStyle(() => {
    // Active when dragging, this list is the target, and our key matches
    const isActive =
      isDragging.value &&
      activeDropListId.value === listId &&
      activeDropSlot.value === slotKey;

    return {
      opacity: isActive ? 1 : 0,
    };
  });

  // Collapsed list — nothing to show
  if (!isExpanded) return null;

  return (
    <View style={styles.insertionLineWrapper}>
      <Animated.View style={[styles.insertionLineBar, barStyle]} />
    </View>
  );
}

/**
 * DragList renders a collapsible list and registers its absolute screen
 * position into the shared layout registry on every layout change.
 * The drag engine reads this registry to know which list the finger is over.
 */
function DragList({
  listId,
  listName,
  listIconLeft,
  tasks,
}: DragListProps): React.ReactElement {
  const { listLayouts, currentScrollY } = useDragContext();

  // Ref to the outer container — used to measure absolute screen position
  const listRef = useAnimatedRef<Animated.View>();

  // Expanded/collapsed toggle state
  const [isExpanded, setIsExpanded] = React.useState(true);
  // Measured height of the content area — needed for the collapse animation target
  const [contentHeight, setContentHeight] = React.useState(0);

  // Drives chevron rotation: 90 = expanded, 0 = collapsed
  const rotation = useSharedValue(90);
  // Drives height and opacity animation: 1 = expanded, 0 = collapsed
  const progress = useSharedValue(1);

  /**
   * Toggles expanded state and animates both the chevron and the content area.
   */
  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);

    // Rotate chevron to indicate new state
    rotation.value = withTiming(next ? 90 : 0, {
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });

    // Drive height/opacity from 0 to 1 or back
    progress.value = withTiming(next ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });
  };

  // Rotates the chevron icon smoothly on toggle
  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Animates the content container height and opacity.
  // When fully expanded (progress=1), explicitly clear any stale height with
  // "auto" so the container follows its children's natural size — this ensures
  // the list shrinks when items are dragged out and grows when items are added.
  // Only constrain height during the collapse/expand animation.
  const contentAnimatedStyle = useAnimatedStyle(() => {
    // Fully expanded — explicitly set "auto" to clear any stale animated height
    if (progress.value === 1) {
      return { height: "auto", opacity: 1 };
    }
    // Fully collapsed — zero height and hidden
    if (progress.value === 0) {
      return { height: 0, opacity: 0, overflow: "hidden" as const };
    }
    // Mid-animation — interpolate between 0 and measured content height
    const animatedHeight = interpolate(
      progress.value,
      [0, 1],
      [0, contentHeight],
      Extrapolation.CLAMP,
    );
    return {
      height: animatedHeight,
      opacity: progress.value,
      overflow: "hidden" as const,
    };
  });

  /**
   * Called whenever the list container's layout changes (mount, expand/collapse,
   * item count change). Measures the absolute screen position and updates the
   * layout registry so the hit-test worklet has accurate list boundaries.
   */
  function handleListLayout() {
    // scheduleOnUI runs the callback on the UI thread where measure() is valid.
    // It runs after the current frame, so layout is settled before we measure.
    scheduleOnUI(() => {
      "worklet";
      // measure() must run on the UI thread — this worklet guarantees that
      const m = measure(listRef);
      if (m === null) return;

      // Update or insert this list's entry in the shared layout registry
      listLayouts.modify((layouts) => {
        "worklet";
        // Find existing entry for this list
        const existingIndex = layouts.findIndex((l) => l.listId === listId);
        const entry = {
          listId,
          pageY: m.pageY,
          height: m.height,
          // Capture scroll offset at measure time so hitTest can correct for
          // any scroll that happens between now and when this boundary is queried
          scrollYAtMeasure: currentScrollY.value,
        };
        if (existingIndex >= 0) {
          // Replace existing entry with fresh measurements
          layouts[existingIndex] = entry;
        } else {
          // First time this list is measured — add it
          layouts.push(entry);
        }
        return layouts;
      });
    });
  }

  return (
    // listRef attached here so measure() can find this view's screen position
    <Animated.View
      ref={listRef}
      style={styles.container}
      onLayout={handleListLayout}
    >
      {/* LIST HEADER — tapping toggles collapse */}
      <TouchableOpacity
        style={styles.listHeader}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.listHeaderContentLeft}>
          {/* User-provided icon element rendered to the left of the list name */}
          {listIconLeft}
          <Text style={styles.listHeaderContentText}>{listName}</Text>
        </View>
        <View style={styles.listHeaderContentRight}>
          {/* Item count badge — reflects current filtered item array length */}
          <Text style={styles.listHeaderContentText}>{tasks.length}</Text>
          {/* Chevron animates rotation to signal expand/collapse state */}
          <Animated.View style={chevronAnimatedStyle}>
            <Ionicons name={"chevron-forward"} size={24} />
          </Animated.View>
        </View>
      </TouchableOpacity>
      {/* END OF LIST HEADER */}

      {/* Animated container that collapses/expands item rows */}
      <Animated.View style={contentAnimatedStyle}>
        <View
          style={styles.taskItemsContainer}
          onLayout={(event) => {
            // Capture the natural height of the content for the collapse animation target.
            // Always update so shrinking lists get an accurate collapse target.
            const h = event.nativeEvent.layout.height;
            if (h !== contentHeight) {
              setContentHeight(h);
            }
          }}
        >
          {/* Slot before the first item — key is the first item's taskId.
              When dragging this item, the hit-test will never output its ID,
              but the InsertionLine below it (slotKey=next item) will light up
              at the correct visual position instead. */}
          {tasks.length > 0 && (
            <InsertionLine
              slotKey={tasks[0].taskId}
              listId={listId}
              isExpanded={isExpanded}
            />
          )}

          {tasks.map((task, index) => (
            <React.Fragment key={task.taskId}>
              <DragItemComponent
                taskId={task.taskId}
                listId={listId}
                order={task.order}
                title={task.title}
                description={task.description}
              />
              {/* Slot after this item — key is the NEXT item's taskId so it
                  matches hitTest's "insert before next item" slot key.
                  The last item's slot uses "end:<listId>" instead. */}
              <InsertionLine
                slotKey={
                  index < tasks.length - 1
                    ? tasks[index + 1].taskId
                    : `end:${listId}`
                }
                listId={listId}
                isExpanded={isExpanded}
              />
            </React.Fragment>
          ))}

          {/* Slot for empty list — allows dropping into a list with no items.
              Only rendered when the list has zero items (e.g. all moved out). */}
          {tasks.length === 0 && (
            <InsertionLine
              slotKey={`end:${listId}`}
              listId={listId}
              isExpanded={isExpanded}
            />
          )}
        </View>
      </Animated.View>
      {/* END OF ITEM ROWS */}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Outer list container with horizontal margin and bottom spacing
  container: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  // Header row — space-between for name on left and count/chevron on right
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  // Left side of header — icon and list name
  listHeaderContentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  // Right side of header — count badge and chevron
  listHeaderContentRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Bold text used for both list name and count
  listHeaderContentText: {
    fontWeight: "bold",
  },
  // Wrapper for all item rows within the list
  taskItemsContainer: {
    paddingTop: 4,
  },
  // Fixed-height slot that always occupies space so overflow:hidden never clips the bar
  insertionLineWrapper: {
    height: 8,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  // The visible 3px blue bar — opacity is animated, height is fixed
  insertionLineBar: {
    height: 3,
    backgroundColor: "#007AFF",
    borderRadius: 2,
  },
});

export default DragList;
