import React, { useEffect, useRef, useState } from "react";
import { Animated, ActivityIndicator, Text, StyleSheet, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SyncingBannerProps {
  visible: boolean;
  label?: string;
  topOffset?: number;
}

/**
 * Availability sync banner. Fully unmounts when hidden so Android cannot leave
 * an orange hairline in the status-bar safe area (translateY alone was leaking).
 */
export default function SyncingBanner({ visible, label = "Syncing…", topOffset = 0 }: SyncingBannerProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 2 }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
      return;
    }

    if (!mounted) return;

    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setMounted(false);
        translateY.setValue(-80);
        opacity.setValue(0);
      }
    });
  }, [visible, mounted, translateY, opacity]);

  if (!mounted) {
    return <View style={styles.placeholder} pointerEvents="none" />;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          top: insets.top + topOffset,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="none"
    >
      <ActivityIndicator size={12} color="#fff" style={{ marginRight: 6 }} />
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
}

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
    zIndex: 9999,
    backgroundColor: "#D97706",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Platform.OS === "web" ? 6 : 8,
    paddingHorizontal: 16,
  },
  text: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});
