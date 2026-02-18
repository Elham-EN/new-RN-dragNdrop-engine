import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

interface TaskItemProps {
  title: string;
  description?: string;
}

export default function TaskItem({
  title,
  description,
}: TaskItemProps): React.ReactElement {
  return (
    <View style={styles.taskItem}>
      {/* Task title - bold and prominent */}
      <Text style={styles.taskTitle}>{title}</Text>
      {/* Task description - smaller and gray */}
      <Text style={styles.taskDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Individual task item row
  taskItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  // Task title text styling
  taskTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  // Task description text styling
  taskDescription: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 20,
  },
});
