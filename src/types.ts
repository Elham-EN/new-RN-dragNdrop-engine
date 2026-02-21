// types.ts — base data types for the drag-and-drop engine.
// DragItem is the minimum shape every draggable item must satisfy.
// Users can extend it with additional fields for their own data models.

// Base shape for a draggable item — every item in the engine must have these fields
export type DragItem = {
  taskId: string; // Unique identifier for the item
  listId: string; // Which list this item belongs to
  // Controls the display order within a list — used for reordering on drag
  order: number;
  title: string; // Display title shown in the item row and ghost
  description: string; // Secondary text shown below the title
};

// Shape of a single item layout entry stored in the layout registry.
// Updated by each DragItem on every layout change via measure() on the UI thread.
export type ItemLayout = {
  taskId: string; // Which item this measurement belongs to
  listId: string; // Which list the item is in
  pageY: number; // Absolute screen Y at the moment measure() was called
  height: number; // Rendered height of the item
  order: number; // Current order within the list
  scrollYAtMeasure: number; // ScrollView offset when pageY was captured — used to
  //                          correct for scroll that happened after the last measure
};

// Shape of a single list layout entry stored in the layout registry.
// Updated by each DragList on every layout change via measure() on the UI thread.
export type ListLayout = {
  listId: string; // Which list this measurement belongs to
  pageY: number; // Absolute screen Y at the moment measure() was called
  height: number; // Rendered height of the list container
  scrollYAtMeasure: number; // ScrollView offset when pageY was captured
};
