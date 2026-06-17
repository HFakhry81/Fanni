import React, { useEffect, useRef } from "react";
import { Animated, ActivityIndicator, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SyncingBannerProps {
  visible: boolean;
  label?: string;
  topOffset?: number;
}

export default function SyncingBanner({ visible, label = "Syncing…", topOffset = 0 }: SyncingBannerProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-60)).current;
  const visibleRef = useRef(false);

  useEffect(() => {
    if (visible && !visibleRef.current) {
      visibleRef.current = true;
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else if (!visible && visibleRef.current) {
      visibleRef.current = false;
      Animated.timing(translateY, {
        toValue: -60,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  return (
    <Animated.View
      style={[
        styles.banner,
        { top: insets.top + topOffset, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <ActivityIndicator size={12} color="#fff" style={{ marginRight: 6 }} />
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
