import { Platform, ScrollView, ScrollViewProps } from "react-native";

/**
 * Use RN ScrollView on native for release stability.
 * react-native-keyboard-controller has caused silent launch crashes on some devices
 * when KeyboardProvider is in the root tree.
 */
export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: ScrollViewProps) {
  return (
    <ScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
