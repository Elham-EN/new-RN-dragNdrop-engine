// Main screen — owns task state and renders the drag ghost above everything else.
// DragProvider wraps the scroll content so all children share the same drag state.
import TaskList from "@/components/TaskList";
import { DragProvider, useDragContext } from "@/context/DragContext";
import { lists, tasks as initialTasks, TaskItem } from "@/data";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── DragGhost ────────────────────────────────────────────────────────────────
// Floating copy of the dragged item rendered above everything (position: absolute).
// Reads ghost shared values from context to track position and visibility.
function DragGhost() {
  const {
    isDragging,
    ghostX,
    ghostY,
    ghostHeight,
    ghostWidth,
    ghostTitle,
    ghostDescription,
  } = useDragContext();

  // Drives absolute position, size, and visibility of the floating ghost
  const ghostStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: ghostX.value,
    top: ghostY.value,
    width: ghostWidth.value,
    height: ghostHeight.value,
    // Only visible during a drag
    opacity: isDragging.value ? 1 : 0,
    zIndex: 9999,
    // Slight scale lift to communicate the item is held
    transform: [{ scale: isDragging.value ? 1.03 : 1 }],
    // Ghost should never intercept touches on items below it
    pointerEvents: "none",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  }));

  // Feeds ghostTitle shared value into Animated.Text as an animatedProp
  const titleAnimatedProps = useAnimatedProps(() => ({
    text: ghostTitle.value,
    // defaultValue prevents a flicker when the shared value first updates
    defaultValue: "",
  } as any));

  // Feeds ghostDescription shared value into Animated.Text
  const descriptionAnimatedProps = useAnimatedProps(() => ({
    text: ghostDescription.value,
    defaultValue: "",
  } as any));

  return (
    <Animated.View style={ghostStyle}>
      {/* Title row — mirrors TaskItem title styling */}
      <Animated.Text
        style={styles.ghostTitle}
        animatedProps={titleAnimatedProps}
      />
      {/* Description row — mirrors TaskItem description styling */}
      <Animated.Text
        style={styles.ghostDescription}
        animatedProps={descriptionAnimatedProps}
      />
    </Animated.View>
  );
}

// ─── Inner screen content — needs context so it can read scrollViewRef ────────
function ScreenContent({ tasks }: { tasks: TaskItem[] }) {
  const insets = useSafeAreaInsets();
  const { scrollViewRef, scrollEnabled, currentScrollY } = useDragContext();

  // Returns tasks for a given list, sorted by order field
  function getTasksForList(listId: string): TaskItem[] {
    return tasks
      .filter((task) => task.listId === listId)
      .sort((a, b) => a.order - b.order);
  }

  // Tie scrollEnabled shared value into the ScrollView's scrollEnabled prop
  const scrollAnimatedProps = useAnimatedProps(() => ({
    scrollEnabled: scrollEnabled.value,
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.header}>My Lists</Text>

      {/* Animated.ScrollView so we can control scrollEnabled from the UI thread
          and call scrollTo during drag auto-scroll without a JS bridge hop */}
      <Animated.ScrollView
        ref={scrollViewRef}
        animatedProps={scrollAnimatedProps}
        onScroll={(event) => {
          // Track scroll position so the auto-scroll worklet knows the current offset
          currentScrollY.value = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16} // ~60fps scroll tracking
      >
        {lists.map((list) => (
          <TaskList
            key={list.listId}
            listId={list.listId}
            listName={list.listName}
            listIconLeft={list.listIcon}
            tasks={getTasksForList(list.listId)}
          />
        ))}
      </Animated.ScrollView>

      {/* Ghost rendered above everything — outside the ScrollView so it isn't clipped */}
      <DragGhost />
    </View>
  );
}

// ─── Index — root of the screen ───────────────────────────────────────────────
export default function Index() {
  // Single source of truth for all tasks — passed into DragProvider so commitDrop
  // can call setTasks directly after a drop
  const [tasks, setTasks] = React.useState<TaskItem[]>(initialTasks);

  return (
    <DragProvider setTasks={setTasks}>
      <ScreenContent tasks={tasks} />
    </DragProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  header: {
    fontSize: 20,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#1C1C1E",
  },
  ghostTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  ghostDescription: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 20,
  },
});
