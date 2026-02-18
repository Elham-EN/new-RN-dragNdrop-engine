// Main screen — owns all task state so drag-and-drop can update it reactively
import TaskList from "@/components/TaskList";
import { lists, tasks as initialTasks, TaskItem } from "@/data";
import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Index() {
  const insets = useSafeAreaInsets();

  // Single source of truth for all tasks — owned here so drag updates re-render the UI
  const [tasks, setTasks] = React.useState<TaskItem[]>(initialTasks);

  // Returns only the tasks belonging to a given list, sorted by their order field
  function getTasksForList(listId: string): TaskItem[] {
    return tasks
      .filter((task) => task.listId === listId)
      .sort((a, b) => a.order - b.order);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.header}>Inbox Screen</Text>
      <ScrollView>
        {lists.map((list) => (
          <TaskList
            key={list.listId}
            listId={list.listId}
            listName={list.listName}
            listIconLeft={list.listIcon}
            // Pass only this list's tasks, pre-filtered and sorted
            tasks={getTasksForList(list.listId)}
            // Callback so TaskList can push reordered/moved tasks back up to state
            onTasksChange={setTasks}
            // Full task array needed so cross-list moves can update the whole state
            allTasks={tasks}
          />
        ))}
      </ScrollView>
    </View>
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
});
