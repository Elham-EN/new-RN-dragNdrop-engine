// DragScrollView — pre-wired Animated.ScrollView for the drag engine.
// Connects scrollViewRef, scrollEnabled, and currentScrollY from the drag context
// so the auto-scroll worklet and hit-test scroll correction work automatically.
import { useDragContext } from "./DragContext";
import * as React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedProps } from "react-native-reanimated";

// Props accepted by DragScrollView — passes through style and content container style
interface DragScrollViewProps {
  children: React.ReactNode; // List content rendered inside the ScrollView
  style?: StyleProp<ViewStyle>; // Optional style for the ScrollView itself
  contentContainerStyle?: StyleProp<ViewStyle>; // Optional style for the scroll content container
}

/**
 * DragScrollView wraps Animated.ScrollView with all the drag engine wiring.
 * It binds scrollViewRef so auto-scroll works, animatedProps so scrollEnabled
 * can be toggled from the UI thread, and onScroll so the hit-test always has
 * the current scroll offset. Drop this in place of a plain ScrollView.
 */
export default function DragScrollView({
  children,
  style,
  contentContainerStyle,
}: DragScrollViewProps) {
  const { scrollViewRef, scrollEnabled, currentScrollY } = useDragContext();

  // Tie scrollEnabled shared value into the ScrollView's scrollEnabled prop
  // so the UI thread can disable scrolling during a drag without a JS bridge hop
  const scrollAnimatedProps = useAnimatedProps(() => ({
    scrollEnabled: scrollEnabled.value,
  }));

  return (
    <Animated.ScrollView
      ref={scrollViewRef}
      style={style}
      contentContainerStyle={contentContainerStyle}
      animatedProps={scrollAnimatedProps}
      onScroll={(event) => {
        // Track scroll position so the auto-scroll worklet knows the current offset
        currentScrollY.value = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16} // ~60fps scroll tracking
    >
      {children}
    </Animated.ScrollView>
  );
}
