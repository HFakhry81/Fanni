import React, { forwardRef, useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

function readPaddingBottom(style: StyleProp<ViewStyle> | undefined): number {
  const flat = StyleSheet.flatten(style) ?? {};
  const value = flat.paddingBottom ?? flat.padding ?? 0;
  return typeof value === "number" ? value : 0;
}

type Props = ScrollViewProps & {
  /** Wrap with KeyboardAvoidingView on iOS (disable when already inside one). */
  enableAvoidingView?: boolean;
};

/**
 * App-wide keyboard-safe scroll container.
 * - iOS: optional KeyboardAvoidingView + automaticallyAdjustKeyboardInsets
 * - Android: keyboard-height bottom padding (reliable with edge-to-edge / APK)
 *
 * Prefer this over plain ScrollView on any screen/modal with text inputs.
 * Avoid react-native-keyboard-controller at root (past APK launch crashes).
 */
export const KeyboardAwareScrollViewCompat = forwardRef<ScrollView, Props>(
  function KeyboardAwareScrollViewCompat(
    {
      children,
      keyboardShouldPersistTaps = "handled",
      contentContainerStyle,
      style,
      enableAvoidingView = true,
      ...props
    },
    ref
  ) {
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
      const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
      const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
      const onShow = Keyboard.addListener(showEvent, (e) => {
        setKeyboardHeight(e.endCoordinates?.height ?? 0);
      });
      const onHide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
      return () => {
        onShow.remove();
        onHide.remove();
      };
    }, []);

    const basePad = readPaddingBottom(contentContainerStyle);
    const extraPad = useMemo(() => {
      if (keyboardHeight <= 0) return 0;
      // Android: full keyboard pad so fields can scroll above the keys.
      // iOS: light pad; KeyboardAvoidingView + insets handle most of the lift.
      return Platform.OS === "android"
        ? Math.max(keyboardHeight - 12, 96)
        : 24;
    }, [keyboardHeight]);

    const scroll = (
      <ScrollView
        ref={ref}
        style={style}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        nestedScrollEnabled
        contentContainerStyle={[
          contentContainerStyle,
          extraPad > 0 ? { paddingBottom: basePad + extraPad } : null,
        ]}
        {...props}
      >
        {children}
      </ScrollView>
    );

    if (Platform.OS === "ios" && enableAvoidingView) {
      return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" enabled>
          {scroll}
        </KeyboardAvoidingView>
      );
    }

    return scroll;
  }
);

/** Bottom-sheet / modal wrapper that lifts content above the keyboard on iOS + Android. */
export function KeyboardAvoidingSheet({
  children,
  style,
  contentPosition = "end",
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** "end" for bottom sheets, "center" for dialogs. */
  contentPosition?: "end" | "center";
}) {
  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[
        {
          flex: 1,
          justifyContent: contentPosition === "center" ? "center" : "flex-end",
        },
        style,
      ]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export default KeyboardAwareScrollViewCompat;
