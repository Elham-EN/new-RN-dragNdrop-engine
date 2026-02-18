import { tasks } from "@/data";
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
}

/**
 * TaskList component displays a collapsible list of tasks.
 * Shows list name on left, chevron icon on right to indicate collapse state.
 *
 * @param taskList - The task list object containing name and tasks array
 */
function TaskList({
  listId,
  listName,
  listIconLeft,
}: TaskListProps): React.ReactElement {
  // Track whether this list is expanded or collapsed
  const [isExpanded, setIsExpanded] = React.useState(true);
  // Store the measured height of the content
  const [contentHeight, setContentHeight] = React.useState(0);

  // Animated value for chevron rotation (0 = right/collapsed,
  // 90 = down/expanded)
  const rotation = useSharedValue(90);
  // Animated value for content progress (0 = collapsed, 1 = expanded)
  const progress = useSharedValue(1);

  /**
   * Toggle the expanded/collapsed state of the task list
   * Animates both the chevron rotation and content visibility
   */
  const toggleExpand = () => {
    // Toggle the expanded state
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    // Animate chevron rotation: 90deg when expanded, 0deg when collapsed
    rotation.value = withTiming(newExpandedState ? 90 : 0, {
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });
    // Animate content progress: 1 when expanded, 0 when collapsed
    progress.value = withTiming(newExpandedState ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });
  };

  /**
   * Animated style for chevron icon rotation
   * Smoothly rotates between 0deg (collapsed) and 90deg (expanded)
   */
  const chevronAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  /**
   * Animated style for task items container
   * Animates height and opacity using measured content height
   */
  const contentAnimatedStyle = useAnimatedStyle(() => {
    // Interpolate height from 0 to measured content height
    const animatedHeight = interpolate(
      progress.value,
      [0, 1],
      [0, contentHeight],
      Extrapolation.CLAMP,
    );

    return {
      // Animate height from 0 to full content height
      height: animatedHeight,
      // Fade opacity from 0 to 1
      opacity: progress.value,
      // Prevent overflow during animation
      overflow: "hidden",
    };
  });

  const listTasks = tasks.filter((task) => task.listId === listId);

  return (
    <View style={styles.container}>
      {/* LIST HEADER */}
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
          <Text style={styles.listHeaderContentText}>{listTasks.length}</Text>
          {/* Chevron icon with smooth rotation animation */}
          <Animated.View style={chevronAnimatedStyle}>
            <Ionicons name={"chevron-forward"} size={24} />
          </Animated.View>
        </View>
      </TouchableOpacity>
      {/* END OF LIST HEADER */}
      {/* List Content - Task Items  */}
      {/* Task items with smooth expand/collapse animation */}
      <Animated.View style={contentAnimatedStyle}>
        <View
          style={styles.taskItemsContainer}
          onLayout={(event) => {
            // Measure the actual height of the content once it renders
            const height = event.nativeEvent.layout.height;
            if (height > 0 && contentHeight !== height) {
              setContentHeight(height);
            }
          }}
        >
          {listTasks.map((taskItem) => (
            <TaskItem
              key={taskItem.taskId}
              title={taskItem.title}
              description={taskItem.description}
            />
          ))}
        </View>
      </Animated.View>
      {/* List Content - Task Items  */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingVertical: 8,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
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
  // Container for all task items in a list
  taskItemsContainer: {
    paddingTop: 4,
  },
});

export default TaskList;
