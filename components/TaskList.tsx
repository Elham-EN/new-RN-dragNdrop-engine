// TaskList — collapsible list of tasks. Registers its screen position into the
// drag context layout registry so the hit-test worklet knows where each list lives.
// Renders blue insertion lines between task items to preview the drop position.
import { useDragContext } from "@/context/DragContext";
import { TaskItem as TaskItemType } from "@/data";
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
import TaskItem from "./TaskItem";

interface TaskListProps {
  listId: string;
  listName: string;
  listIconLeft: keyof typeof Ionicons.glyphMap;
  // Pre-filtered and sorted tasks for this list — supplied by index.tsx state
  tasks: TaskItemType[];
}

// ─── InsertionLine ────────────────────────────────────────────────────────────
// A thin blue horizontal rule that appears at the active drop slot.
// slotIndex: the insertion index this line represents (0 = before first item,
//   n = after last item). Visible only when this list is the drop target
//   and activeDropIndex matches slotIndex.
interface InsertionLineProps {
  slotIndex: number;        // Which slot this line guards
  listId: string;           // The list this line belongs to
  isExpanded: boolean;      // Hide entirely when list is collapsed
}

/**
 * InsertionLine renders a 3px blue bar that appears at the active drop slot.
 * useAnimatedStyle reads the shared values directly on the UI thread —
 * no useAnimatedReaction needed, it re-runs automatically every frame the
 * values change.
 */
function InsertionLine({ slotIndex, listId, isExpanded }: InsertionLineProps) {
  const { activeDropListId, activeDropIndex, isDragging } = useDragContext();

  // Outer container is always 8px tall so the parent overflow:hidden doesn't
  // clip it. The inner bar fades in/out via opacity — no height animation.
  const barStyle = useAnimatedStyle(() => {
    // Active when: a drag is happening, this list is the target, and slot matches
    const isActive =
      isDragging.value &&
      activeDropListId.value === listId &&
      activeDropIndex.value === slotIndex;

    return {
      opacity: isActive ? 1 : 0,   // fade in when active, invisible otherwise
    };
  });

  // When list is collapsed the content is hidden — skip rendering
  if (!isExpanded) return null;

  // Fixed-height wrapper — always occupies 8px so overflow:hidden never clips it.
  // The 3px blue bar sits centred inside via justifyContent.
  return (
    <View style={styles.insertionLineWrapper}>
      <Animated.View style={[styles.insertionLineBar, barStyle]} />
    </View>
  );
}

/**
 * TaskList renders a collapsible list and registers its absolute screen
 * position into the shared layout registry on every layout change.
 * The drag engine reads this registry to know which list the finger is over.
 */
function TaskList({
  listId,
  listName,
  listIconLeft,
  tasks,
}: TaskListProps): React.ReactElement {
  const { listLayouts } = useDragContext();

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

  // Animates the content container height and opacity
  const contentAnimatedStyle = useAnimatedStyle(() => {
    // Interpolate between 0 and the measured content height
    const animatedHeight = interpolate(
      progress.value,
      [0, 1],
      [0, contentHeight],
      Extrapolation.CLAMP,
    );
    return {
      height: animatedHeight,
      opacity: progress.value,
      // No overflow:hidden — it would clip the insertion line bars during drag
    };
  });

  /**
   * Called whenever the list container's layout changes (mount, expand/collapse,
   * task count change). Measures the absolute screen position and updates the
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
        const entry = { listId, pageY: m.pageY, height: m.height };
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
    <Animated.View ref={listRef} style={styles.container} onLayout={handleListLayout}>
      {/* LIST HEADER — tapping toggles collapse */}
      <TouchableOpacity
        style={styles.listHeader}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.listHeaderContentLeft}>
          <Ionicons name={listIconLeft} size={24} />
          <Text style={styles.listHeaderContentText}>{listName}</Text>
        </View>
        <View style={styles.listHeaderContentRight}>
          {/* Task count badge — reflects current filtered task array length */}
          <Text style={styles.listHeaderContentText}>{tasks.length}</Text>
          {/* Chevron animates rotation to signal expand/collapse state */}
          <Animated.View style={chevronAnimatedStyle}>
            <Ionicons name={"chevron-forward"} size={24} />
          </Animated.View>
        </View>
      </TouchableOpacity>
      {/* END OF LIST HEADER */}

      {/* Animated container that collapses/expands task items */}
      <Animated.View style={contentAnimatedStyle}>
        <View
          style={styles.taskItemsContainer}
          onLayout={(event) => {
            // Capture the natural height of the content for the animation target
            const h = event.nativeEvent.layout.height;
            if (h > 0 && h !== contentHeight) {
              setContentHeight(h);
            }
          }}
        >
          {/* Insertion line at slot 0 — before the first task item */}
          <InsertionLine slotIndex={0} listId={listId} isExpanded={isExpanded} />

          {tasks.map((task, index) => (
            <React.Fragment key={task.taskId}>
              <TaskItem
                taskId={task.taskId}
                listId={listId}
                order={task.order}
                title={task.title}
                description={task.description}
              />
              {/* Insertion line after each item — slot index = item index + 1 */}
              <InsertionLine
                slotIndex={index + 1}
                listId={listId}
                isExpanded={isExpanded}
              />
            </React.Fragment>
          ))}
        </View>
      </Animated.View>
      {/* END OF TASK ITEMS */}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  listHeaderContentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  listHeaderContentRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  listHeaderContentText: {
    fontWeight: "bold",
  },
  // Wrapper for all task item rows within the list
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

export default TaskList;
