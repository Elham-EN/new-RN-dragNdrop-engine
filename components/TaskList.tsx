// TaskList component — displays a collapsible list of task items for a given list
import { TaskItem as TaskItemType } from "@/data";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import TaskItem from "./TaskItem";

interface TaskListProps {
  listId: string;
  listName: string;
  listIconLeft: keyof typeof Ionicons.glyphMap;
  // Tasks already filtered and sorted for this list — passed down from parent state
  tasks: TaskItemType[];
  // Full task array — needed so cross-list moves can replace the whole state at once
  allTasks: TaskItemType[];
  // Callback to push any task state change (reorder or cross-list move) back up to index.tsx
  onTasksChange: (updatedTasks: TaskItemType[]) => void;
}

/**
 * TaskList component displays a collapsible list of tasks.
 * Shows list name on left, chevron icon on right to indicate collapse state.
 * Receives its tasks as a prop so drag-and-drop state updates flow from the parent.
 */
function TaskList({
  listName,
  listIconLeft,
  tasks,
}: TaskListProps): React.ReactElement {
  // Track whether this list is expanded or collapsed
  const [isExpanded, setIsExpanded] = React.useState(true);
  // Store the measured height of the content so the collapse animation knows the target
  const [contentHeight, setContentHeight] = React.useState(0);

  // Animated value for chevron rotation: 90 = expanded (pointing down), 0 = collapsed
  const rotation = useSharedValue(90);
  // Animated value driving both height and opacity: 1 = expanded, 0 = collapsed
  const progress = useSharedValue(1);

  /**
   * Toggles expanded/collapsed state and triggers both the chevron and
   * height/opacity animations simultaneously.
   */
  const toggleExpand = () => {
    // Flip the expanded state
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);

    // Rotate chevron: 90deg when expanded, 0deg when collapsed
    rotation.value = withTiming(newExpandedState ? 90 : 0, {
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });

    // Drive height/opacity: 1 when expanded, 0 when collapsed
    progress.value = withTiming(newExpandedState ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });
  };

  // Animated style for the chevron icon — rotates smoothly on toggle
  const chevronAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // Animated style for the task items container — animates height and opacity
  const contentAnimatedStyle = useAnimatedStyle(() => {
    // Interpolate from 0 to the measured content height
    const animatedHeight = interpolate(
      progress.value,
      // (Input Range): The expected range of progress.value.
      [0, 1],
      // (Output Range): The corresponding height values mapped from the input range.
      [0, contentHeight],
      // using Extrapolation.CLAMP to ensure the height never goes below 0 or
      // above contentHeight
      Extrapolation.CLAMP,
    );

    return {
      height: animatedHeight,
      opacity: progress.value,
      // Hide overflow so items don't bleed outside the animated height
      overflow: "hidden",
    };
  });

  return (
    <View style={styles.container}>
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
          {/* Show the count of tasks in this list */}
          <Text style={styles.listHeaderContentText}>{tasks.length}</Text>
          {/* Chevron rotates to signal expanded/collapsed state */}
          <Animated.View style={chevronAnimatedStyle}>
            <Ionicons name={"chevron-forward"} size={24} />
          </Animated.View>
        </View>
      </TouchableOpacity>
      {/* END OF LIST HEADER */}

      {/* Task items — animated expand/collapse container */}
      <Animated.View style={contentAnimatedStyle}>
        <View
          style={styles.taskItemsContainer}
          onLayout={(event) => {
            // Measure the real rendered height so the animation has the correct target
            const height = event.nativeEvent.layout.height;
            if (height > 0 && contentHeight !== height) {
              setContentHeight(height);
            }
          }}
        >
          {tasks.map((task) => (
            <TaskItem
              key={task.taskId}
              taskId={task.taskId}
              title={task.title}
              description={task.description}
            />
          ))}
        </View>
      </Animated.View>
      {/* END OF TASK ITEMS */}
    </View>
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
  // Wrapper for all rendered task items within a list
  taskItemsContainer: {
    paddingTop: 4,
  },
});

export default TaskList;
