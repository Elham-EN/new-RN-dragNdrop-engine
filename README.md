# Drag & Drop Engine for React Native

A custom-built drag-and-drop engine for reordering and moving items across lists in React Native. Built from scratch because existing third-party drag-and-drop libraries are outdated, relying on the old React Native architecture and deprecated APIs that no longer align with the modern ecosystem.

## Table of Contents

- [Demo](#demo)
- [Why Build This?](#why-build-this)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Get Started](#get-started)
- [Contributing](#contributing)
- [License](#license)

## Demo

<img src="assets/preview.gif" width="300" alt="Drag and drop demo" />

## Why Build This?

Third-party drag-and-drop libraries for React Native have not kept pace with the platform. Most still target the legacy architecture (Bridge-based) and depend on older versions of Reanimated, Gesture Handler, and lack support for the new worklets threading model. This leads to:

- **Dropped frames during drag** — gesture callbacks crossing the JS bridge introduce latency that breaks smooth 60/120fps tracking.
- **Stale layout data** — libraries that measure positions on the JS thread get out-of-date values when the UI thread has already moved on.
- **Incompatibility with New Architecture** — the Bridgeless mode, Fabric renderer, and TurboModules require libraries to adopt new threading patterns that most drag-and-drop solutions haven't adopted yet.

This engine was built to run entirely on the **New Architecture** with the latest stable releases of its core dependencies.

## Tech Stack

| Dependency | Version | Role |
|---|---|---|
| React Native | 0.81 | New Architecture (Bridgeless, Fabric) |
| Reanimated 4 | ~4.1.1 | Shared values, `useAnimatedStyle`, `measure()` on UI thread |
| Gesture Handler | ~2.28.0 | Pan gesture with long-press activation, simultaneous gesture handling |
| React Native Worklets | 0.5.1 | `scheduleOnUI` / `scheduleOnRN` for cross-thread communication |
| Expo Haptics | ~15.0.8 | Tactile feedback on pickup, slot change, and drop |

## Features

- **Within-list reorder** — long-press an item, drag it to a new position in the same list, and drop it. The list reorders instantly.
- **Cross-list move** — drag an item from one list and drop it into any other list at any position.
- **Visual drop indicator** — a blue insertion line appears at the exact gap where the item will land, updating in real-time as you drag.
- **Floating ghost** — a scaled-down copy of the dragged item follows the finger, rendered above all other content so it's never clipped by scroll containers.
- **Auto-scroll** — when dragging near the top or bottom edge of the ScrollView, the list scrolls automatically at a speed proportional to how close the finger is to the edge.
- **Haptic feedback** — four distinct haptic responses: medium impact on pickup, selection tick on slot change, success notification on valid drop, warning notification on invalid drop.
- **Collapsible lists** — each list can be expanded or collapsed with a smooth height animation. The drag engine respects collapsed state and only targets expanded lists.
- **Dynamic list sizing** — list containers grow and shrink automatically as items are added or removed via drag.
- **Scroll-corrected hit-testing** — layout measurements are captured with the scroll offset at measure time, and the hit-test worklet corrects for any scroll that happened since, so positions are always accurate.

## Architecture

The engine is split into three layers:

### 1. Shared State (`DragContext`)
A React context that holds all Reanimated shared values: drag identity, ghost position, drop target tracking, scroll control, and the layout registry. Every component reads from and writes to these values during a drag.

### 2. Gesture & Hit-Test (`TaskItem`)
Each task item owns a Pan gesture (activated after a 400ms long-press). All gesture callbacks (`onBegin`, `onStart`, `onUpdate`, `onEnd`, `onFinalize`) run as **worklets on the UI thread** for zero-latency tracking. The hit-test function runs every frame during drag — it walks the layout registry, corrects for scroll offset, and determines which list and slot the finger is over.

### 3. Layout Registry (`TaskItem` + `TaskList`)
Both items and lists register their absolute screen positions into shared value arrays via `scheduleOnUI` + `measure()`. This runs on the UI thread so measurements are always frame-accurate. The registry is the single source of truth for hit-testing.

### Threading Model

```
UI Thread (worklets)          RN/JS Thread
├── Gesture callbacks         ├── commitDrop (React setState)
├── Hit-test every frame      ├── Haptic feedback calls
├── Ghost position updates    └── Layout registration triggers
├── Auto-scroll via scrollTo
└── measure() for layout
```

`scheduleOnRN` bridges from UI to JS thread for state commits and haptics. `scheduleOnUI` bridges from JS to UI thread for layout measurements. No legacy bridge involved.

## How It Works

1. **Long-press (400ms)** activates the drag. The item's position is measured, the ghost is placed over it, and the item becomes invisible.
2. **Drag** — every frame, the ghost follows the finger, the hit-test worklet determines the target list and insertion slot, and the insertion line updates.
3. **Drop** — if the finger is over a valid slot, `commitDrop` is called on the JS thread. It updates React state in a single `setTasks` call, handling both same-list reorder and cross-list move. If the drop is invalid, the ghost springs back to its origin.
4. **Cleanup** — scroll is re-enabled, drop indicators are cleared, and the item's opacity is restored.

## Get Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## Contributing

Contributions are welcome! This project is open source under the [MIT License](LICENSE).

### How to Contribute

1. **Fork** the repository
2. **Create a branch** for your feature or fix
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** — follow the existing code style and comment conventions
4. **Test on a real device** — drag-and-drop behaviour can differ between simulators and physical devices, so always verify on hardware
5. **Commit** with a clear message describing what changed and why
6. **Push** your branch and open a **Pull Request** against `main`

### Guidelines

- **Keep it simple** — avoid over-engineering. Only add what is needed for the feature or fix.
- **Comment your code** — every function and significant variable should have a short comment explaining what it does and why.
- **UI thread awareness** — gesture callbacks and hit-test logic run as worklets. Any new logic in these paths must use the `"worklet"` directive and avoid JS-thread APIs. Use `scheduleOnRN` to call JS-thread functions from worklets.
- **Test across lists** — verify within-list reorder, cross-list move, empty list drops, and auto-scroll behaviour.
- **No breaking changes** without discussion — if your change affects the public API or drag behaviour, open an issue first to discuss the approach.

### Ideas for Contribution

- Drag handle support (drag from a specific grip icon instead of long-press anywhere)
- Animated item reflow (items slide apart to make room for the dragged item)
- Horizontal list support
- Accessibility improvements (screen reader announcements during drag)
- Performance profiling and optimisation for very long lists (100+ items)

## License

This project is licensed under the [MIT License](LICENSE).
