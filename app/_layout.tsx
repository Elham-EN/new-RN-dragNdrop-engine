import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <GestureHandlerRootView>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
