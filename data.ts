import Ionicons from "@expo/vector-icons/Ionicons";

export type ListData = {
  listId: string;
  listName: string;
  listIcon: keyof typeof Ionicons.glyphMap;
};

export const lists: ListData[] = [
  {
    listId: "listInbox001",
    listName: "Inbox",
    listIcon: "archive-outline",
  },
  {
    listId: "listToday002",
    listName: "Today",
    listIcon: "sunny-outline",
  },
];
