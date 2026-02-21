// DragGhost — floating copy of the dragged item rendered above everything.
// Reads ghost shared values from context to track position and visibility.
// Uses useAnimatedReaction + scheduleOnRN to sync shared values to React state
// so the ghost renders actual Text children.
import { useDragContext } from "./DragContext";
import * as React from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/**
 * DragGhost renders a scaled-down, floating copy of the dragged item.
 * It is positioned absolutely and follows the finger during a drag.
 * Must be rendered inside a DragProvider, outside the ScrollView so it isn't clipped.
 */
export default function DragGhost() {
  const {
    isDragging,
    ghostX,
    ghostY,
    ghostHeight,
    ghostWidth,
    ghostTitle,
    ghostDescription,
  } = useDragContext();

  // React state that mirrors the shared values — updated via scheduleOnRN
  // so the ghost can render actual Text children
  const [displayTitle, setDisplayTitle] = React.useState("");
  const [displayDescription, setDisplayDescription] = React.useState("");

  // Sync ghostTitle shared value to React state when it changes on the UI thread
  useAnimatedReaction(
    () => ghostTitle.value,
    (current) => {
      scheduleOnRN(setDisplayTitle, current);
    },
  );

  // Sync ghostDescription shared value to React state when it changes on the UI thread
  useAnimatedReaction(
    () => ghostDescription.value,
    (current) => {
      scheduleOnRN(setDisplayDescription, current);
    },
  );

  // Ghost shrinks to 35% of the original item size when picked up.
  // To keep it visually centred on the finger, we offset left/top by
  // half the size reduction so the ghost stays under the finger.
  const GHOST_SCALE = 0.35; // how small the ghost appears while dragging

  // Drives absolute position, size, and visibility of the floating ghost
  const ghostStyle = useAnimatedStyle(() => {
    // Amount the ghost shrinks on each axis — used to re-centre it
    const xOffset = (ghostWidth.value * (1 - GHOST_SCALE)) / 2;
    const yOffset = (ghostHeight.value * (1 - GHOST_SCALE)) / 2;

    return {
      position: "absolute",
      // Shift origin so the scaled-down ghost stays centred on the pickup point
      left: ghostX.value + xOffset,
      top: ghostY.value + yOffset,
      width: ghostWidth.value,
      height: ghostHeight.value,
      // Only visible during a drag
      opacity: isDragging.value ? 1 : 0,
      zIndex: 9999,
      // Scale down to GHOST_SCALE so the ghost looks smaller than the real item
      transform: [{ scale: isDragging.value ? GHOST_SCALE : 1 }],
      // Ghost should never intercept touches on items below it
      pointerEvents: "none",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 12,
      backgroundColor: "#fff",
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: "center",
    };
  });

  return (
    <Animated.View style={ghostStyle}>
      {/* Title row — mirrors DragItemComponent title styling */}
      <Text style={styles.ghostTitle}>{displayTitle}</Text>
      {/* Description row — mirrors DragItemComponent description styling */}
      {displayDescription ? (
        <Text style={styles.ghostDescription}>{displayDescription}</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Ghost title — matches item title styling
  ghostTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  // Ghost description — matches item description styling
  ghostDescription: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 20,
  },
});
