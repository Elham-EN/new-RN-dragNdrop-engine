// TaskItem component — displays a single task row with title and description
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

interface TaskItemProps {
  // Unique identifier for this task — needed by the drag engine to know what is being dragged
  taskId: string;
  title: string;
  description?: string;
}

/**
 * TaskItem displays a single task with its title and description.
 * Receives taskId so the drag engine can identify which task is being moved.
 */
export default function TaskItem({
  taskId: _taskId,
  title,
  description,
}: TaskItemProps): React.ReactElement {
  return (
    <View style={styles.taskItem}>
      {/* Task title — bold and prominent */}
      <Text style={styles.taskTitle}>{title}</Text>
      {/* Task description — smaller and muted */}
      <Text style={styles.taskDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Individual task row container
  taskItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
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
