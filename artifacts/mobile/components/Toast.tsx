import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

interface ToastProps {
  visible: boolean;
  message: string;
  duration?: number;
  onHide: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export default function Toast({ visible, message, duration = 2000, onHide, action }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const dismissedRef = useRef(false);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  const fireHide = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onHideRef.current();
  };

  const dismiss = () => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => fireHide());
  };

  useEffect(() => {
    if (visible) {
      dismissedRef.current = false;
      opacity.setValue(0);
      const anim = Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]);
      animationRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) {
          fireHide();
        }
      });
    }
  }, [visible, duration]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Feather name="check-circle" size={18} color="#FFF" style={{ marginRight: 8 }} />
      <Text style={[styles.text, { flex: 1 }]}>{message}</Text>
      {action && (
        <TouchableOpacity
          onPress={() => {
            action.onPress();
            dismiss();
          }}
          style={styles.actionBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      )}
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
    maxWidth: 340,
  },
  text: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  actionBtn: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 14,
  },
  actionText: {
    color: "#FFF",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
});
