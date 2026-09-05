import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";

interface ConnectionBannerProps {
  connected: boolean;
  reconnectingLabel?: string;
  /** Delay before showing after disconnect (avoids flicker). Default 8000ms. */
  showDelayMs?: number;
}

/**
 * Always mounted. Shows after a debounce when disconnected; hides immediately when connected.
 * Avoids a stuck thin orange strip from partial opacity / remount races on Android.
 */
export default function ConnectionBanner({
  connected,
  reconnectingLabel = "Reconnecting…",
  showDelayMs = 8000,
}: ConnectionBannerProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!connected) {
      timerRef.current = setTimeout(() => {
        setShown(true);
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 2 }),
          Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        ]).start();
      }, showDelayMs);
    } else {
      // Hide immediately — no residual orange line after reconnect
      setShown(false);
      translateY.stopAnimation();
      opacity.stopAnimation();
      translateY.setValue(-100);
      opacity.setValue(0);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connected, showDelayMs, translateY, opacity]);

  // Collapsed when hidden — never leave an absolute orange frame in the status bar
  if (!shown) {
    return <View style={styles.placeholder} pointerEvents="none" />;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          top: insets.top,
          transform: [{ translateY }],
          opacity,
          backgroundColor: "#B45309",
        },
      ]}
      pointerEvents="none"
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? "yes" : "no-hide-descendants"}
    >
      <VectorIcon name="wifi-off" size={14} color="#fff" style={{ marginRight: 6 }} />
      <Text style={styles.text}>{reconnectingLabel}</Text>
    </Animated.View>
  );
}

export const CONNECTION_BANNER_PADDING_VERTICAL = Platform.OS === "web" ? 6 : 8;
export const CONNECTION_BANNER_LINE_HEIGHT = 18;
export const CONNECTION_BANNER_HEIGHT =
  CONNECTION_BANNER_PADDING_VERTICAL * 2 + CONNECTION_BANNER_LINE_HEIGHT;

const styles = StyleSheet.create({
  placeholder: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10000,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: CONNECTION_BANNER_PADDING_VERTICAL,
    paddingHorizontal: 16,
  },
  text: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});
