import TaskList from "@/components/TaskList";
import { lists } from "@/data";
import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Index() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.header}>Inbox Screen</Text>
      <ScrollView>
        {lists.map((taskList) => (
          <TaskList
            key={taskList.listId}
            listId={taskList.listId}
            listName={taskList.listName}
            listIconLeft={taskList.listIcon}
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
