import { Platform, ScrollView, ScrollViewProps } from "react-native";

/**
 * Use RN ScrollView on native for release stability.
 * Avoid react-native-keyboard-controller / KeyboardProvider at root —
 * they caused silent launch crashes on some Android devices.
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
