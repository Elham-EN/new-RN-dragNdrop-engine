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
  {
    listId: "listUpcoming003",
    listName: "Upcoming",
    listIcon: "calendar-outline",
  },
  {
    listId: "listSomeday004",
    listName: "Someday",
    listIcon: "albums-outline",
  },
];

export type TaskItem = {
  taskId: string;
  listId: string;
  // Controls the display order within a list — used for reordering on drag
  order: number;
  title: string;
  description: string;
};

export const tasks: TaskItem[] = [
  {
    taskId: "task001",
    listId: "listInbox001",
    order: 0,
    title: "Buy groceries",
    description: "Milk, eggs, bread, and coffee",
  },
  {
    taskId: "task002",
    listId: "listInbox001",
    order: 1,
    title: "Team standup",
    description: "Daily sync with the engineering team at 9am",
  },
  {
    taskId: "task003",
    listId: "listInbox001",
    order: 2,
    title: "Review pull request",
    description: "Check the drag-and-drop feature branch before merging",
  },
  {
    taskId: "task004",
    listId: "listToday002",
    order: 0,
    title: "Write unit tests",
    description: "Cover TaskList and TaskItem components with basic tests",
  },
  {
    taskId: "task005",
    listId: "listToday002",
    order: 1,
    title: "Update app icon",
    description: "Replace placeholder icon with the final design asset",
  },
  {
    taskId: "task006",
    listId: "listInbox001",
    order: 3,
    title: "Fix login bug",
    description: "Users are getting logged out on app resume — investigate token refresh",
  },
  {
    taskId: "task007",
    listId: "listInbox001",
    order: 4,
    title: "Design review",
    description: "Go through Figma screens with the design team before dev handoff",
  },
  {
    taskId: "task008",
    listId: "listToday002",
    order: 2,
    title: "Deploy to staging",
    description: "Push the latest build to the staging environment for QA",
  },
  {
    taskId: "task009",
    listId: "listToday002",
    order: 3,
    title: "Update dependencies",
    description: "Run npm outdated and bump packages to latest stable versions",
  },
  {
    taskId: "task010",
    listId: "listInbox001",
    order: 5,
    title: "Write release notes",
    description: "Summarise the changes in v1.2 for the App Store update",
  },
];
