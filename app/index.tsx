// Main screen — owns task state and renders the drag ghost above everything else.
// DragProvider wraps the scroll content so all children share the same drag state.
import {
  DragProvider,
  DragList,
  DragGhost,
  DragScrollView,
} from "@/src";
import { tasks as initialTasks, lists, TaskItem } from "@/data";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Inner screen content — needs context so DragScrollView can read scrollViewRef
function ScreenContent({ tasks }: { tasks: TaskItem[] }) {
  const insets = useSafeAreaInsets();

  // Returns tasks for a given list, sorted by order field
  function getTasksForList(listId: string): TaskItem[] {
    return tasks
      .filter((task) => task.listId === listId)
      .sort((a, b) => a.order - b.order);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.header}>My Lists</Text>

      {/* DragScrollView pre-wires scrollViewRef, scrollEnabled, and currentScrollY
          from the drag context so auto-scroll and hit-test correction work */}
      <DragScrollView>
        {lists.map((list) => (
          <DragList
            key={list.listId}
            listId={list.listId}
            listName={list.listName}
            listIconLeft={<Ionicons name={list.listIcon} size={24} />}
            tasks={getTasksForList(list.listId)}
          />
        ))}
      </DragScrollView>

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
  // Full-screen container with light background
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  // Screen title at the top
  header: {
    fontSize: 20,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#1C1C1E",
  },
});
