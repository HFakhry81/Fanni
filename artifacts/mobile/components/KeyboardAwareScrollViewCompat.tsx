import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type NativeMethods,
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

type KbScrollApi = {
  scrollToInput: (node: Parameters<typeof findNodeHandle>[0]) => void;
};

const KeyboardScrollContext = createContext<KbScrollApi | null>(null);

/** Call from focused TextInputs so the field scrolls above the keyboard. */
export function useKeyboardAwareScroll() {
  return useContext(KeyboardScrollContext);
}

/**
 * App-wide keyboard-safe scroll container.
 * Android uses softwareKeyboardLayoutMode=resize — avoid double full-keyboard padding;
 * scroll the focused field into view instead.
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
    const innerRef = useRef<ScrollView | null>(null);

    const setRefs = useCallback(
      (node: ScrollView | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<ScrollView | null>).current = node;
      },
      [ref]
    );

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

    const scrollToInput = useCallback((target: Parameters<typeof findNodeHandle>[0]) => {
      // findNodeHandle throws on web — use DOM/measure fallback only there.
      if (Platform.OS === "web") {
        try {
          const el = target as unknown as { focus?: () => void };
          el?.focus?.();
          const node = target as unknown as HTMLElement | null;
          if (node && typeof (node as HTMLElement).scrollIntoView === "function") {
            (node as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
          }
        } catch {
          // ignore web scroll helpers
        }
        return;
      }
      const scrollNode = findNodeHandle(innerRef.current);
      const inputNode = findNodeHandle(target);
      if (!scrollNode || !inputNode || !innerRef.current) return;
      const responder = innerRef.current as ScrollView & {
        getScrollResponder?: () => {
          scrollResponderScrollNativeHandleToKeyboard?: (
            nodeHandle: number,
            offset: number,
            animated: boolean
          ) => void;
        };
      };
      const sr = responder.getScrollResponder?.();
      if (sr?.scrollResponderScrollNativeHandleToKeyboard) {
        // Keep a comfortable gap above the keyboard / nav buttons
        sr.scrollResponderScrollNativeHandleToKeyboard(inputNode, 320, true);
        return;
      }
      // Fallback: measure relative to scroll content
      const input = target as unknown as NativeMethods;
      if (typeof input.measureLayout !== "function") return;
      input.measureLayout(
        scrollNode,
        (_x, y) => {
          innerRef.current?.scrollTo({ y: Math.max(y - 120, 0), animated: true });
        },
        () => undefined
      );
    }, []);

    const api = useMemo(() => ({ scrollToInput }), [scrollToInput]);

    const basePad = readPaddingBottom(contentContainerStyle);
    // Reserve a full keyboard-height footer so the last field scrolls above the keys.
    const extraPad = useMemo(() => {
      if (keyboardHeight <= 0) return 0;
      const footer = keyboardHeight + (Platform.OS === "ios" ? 24 : 16);
      return Math.min(footer, 420);
    }, [keyboardHeight]);

    const scroll = (
      <ScrollView
        ref={setRefs}
        style={[{ flex: 1 }, style]}
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
        <KeyboardScrollContext.Provider value={api}>
          {children}
        </KeyboardScrollContext.Provider>
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
