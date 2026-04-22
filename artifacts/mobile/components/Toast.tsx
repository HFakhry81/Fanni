import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";

interface ToastProps {
  visible: boolean;
  message: string;
  duration?: number;
  onHide: () => void;
}

export default function Toast({ visible, message, duration = 2000, onHide }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Feather name="check-circle" size={18} color="#FFF" style={{ marginRight: 8 }} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 40 : 80,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#22A36B",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
  },
  text: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
