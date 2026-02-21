// Main screen — owns task state and renders the drag ghost above everything else.
// DragProvider wraps the scroll content so all children share the same drag state.
import TaskList from "@/components/TaskList";
import { DragProvider, useDragContext } from "@/context/DragContext";
import { tasks as initialTasks, lists, TaskItem } from "@/data";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

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

  // React state that mirrors the shared values — updated via scheduleOnRN
  // so the ghost can render actual Text children instead of broken animatedProps
  const [displayTitle, setDisplayTitle] = React.useState("");
  const [displayDescription, setDisplayDescription] = React.useState("");

  // Sync ghostTitle shared value to React state when it changes on the UI thread
  useAnimatedReaction(
    () => ghostTitle.value,
    (current) => {
      scheduleOnRN(setDisplayTitle, current);
    },
  );

  // Sync ghostDescription shared value to React state when it changes on the UI thread
  useAnimatedReaction(
    () => ghostDescription.value,
    (current) => {
      scheduleOnRN(setDisplayDescription, current);
    },
  );

  // Ghost shrinks to 35% of the original item size when picked up.
  // To keep it visually centred on the finger, we offset left/top by
  // half the size reduction so the ghost stays under the finger.
  const GHOST_SCALE = 0.35; // how small the ghost appears while dragging

  // Drives absolute position, size, and visibility of the floating ghost
  const ghostStyle = useAnimatedStyle(() => {
    // Amount the ghost shrinks on each axis — used to re-centre it
    const xOffset = (ghostWidth.value * (1 - GHOST_SCALE)) / 2;
    const yOffset = (ghostHeight.value * (1 - GHOST_SCALE)) / 2;

    return {
      position: "absolute",
      // Shift origin so the scaled-down ghost stays centred on the pickup point
      left: ghostX.value + xOffset,
      top: ghostY.value + yOffset,
      width: ghostWidth.value,
      height: ghostHeight.value,
      // Only visible during a drag
      opacity: isDragging.value ? 1 : 0,
      zIndex: 9999,
      // Scale down to GHOST_SCALE so the ghost looks smaller than the real item
      transform: [{ scale: isDragging.value ? GHOST_SCALE : 1 }],
      // Ghost should never intercept touches on items below it
      pointerEvents: "none",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 12,
      backgroundColor: "#fff",
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: "center",
    };
  });

  return (
    <Animated.View style={ghostStyle}>
      {/* Title row — mirrors TaskItem title styling */}
      <Text style={styles.ghostTitle}>{displayTitle}</Text>
      {/* Description row — mirrors TaskItem description styling */}
      {displayDescription ? (
        <Text style={styles.ghostDescription}>{displayDescription}</Text>
      ) : null}
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
