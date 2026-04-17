import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { useApp } from "@/context/AppContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function IndexScreen() {
  const { isLoggedIn, userType } = useApp();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoggedIn) {
        router.replace("/welcome");
      } else {
        if (userType === "client") {
          router.replace("/(client)/home");
        } else if (userType === "technician") {
          router.replace("/(tech)/map");
        } else if (userType === "admin") {
          router.replace("/(admin)/dashboard");
        } else {
          router.replace("/welcome");
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isLoggedIn, userType]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
