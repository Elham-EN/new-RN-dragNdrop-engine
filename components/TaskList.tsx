import { tasks } from "@/data";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import TaskItem from "./TaskItem";

interface TaskListProps {
  listId: string;
  listName: string;
  listIconLeft: keyof typeof Ionicons.glyphMap;
}

function TaskList({
  listId,
  listName,
  listIconLeft,
}: TaskListProps): React.ReactElement {
  const listTasks = tasks.filter((task) => task.listId === listId);

  return (
    <View style={styles.container}>
      {/* LIST HEADER */}
      <View style={styles.listHeader}>
        <View style={styles.listHeaderContentLeft}>
          <Ionicons name={listIconLeft} size={24} />
          <Text style={styles.listHeaderContentText}>{listName}</Text>
        </View>
        <View style={styles.listHeaderContentRight}>
          <Text style={styles.listHeaderContentText}>{listTasks.length}</Text>
          <Ionicons name={"chevron-forward"} size={24} />
        </View>
      </View>
      {/* END OF LIST HEADER */}
      {/* List Content - Task Items  */}
      <View>
        {listTasks.map((taskItem) => (
          <TaskItem
            key={taskItem.taskId}
            title={taskItem.title}
            description={taskItem.description}
          />
        ))}
      </View>
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
});

export default TaskList;
