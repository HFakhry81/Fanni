import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";

interface ConnectionBannerProps {
  connected: boolean;
  reconnectingLabel?: string;
}

export default function ConnectionBanner({ connected, reconnectingLabel = "Reconnecting…" }: ConnectionBannerProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-60)).current;
  const visibleRef = useRef(false);

  useEffect(() => {
    if (!connected && !visibleRef.current) {
      visibleRef.current = true;
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else if (connected && visibleRef.current) {
      visibleRef.current = false;
      Animated.timing(translateY, {
        toValue: -60,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [connected, translateY]);

  return (
    <Animated.View
      style={[
        styles.banner,
        { top: insets.top, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <VectorIcon name="wifi-off" size={14} color="#fff" style={{ marginRight: 6 }} />
      <Text style={styles.text}>{reconnectingLabel}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10000,
    backgroundColor: "#B45309",
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
