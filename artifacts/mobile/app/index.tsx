import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function IndexScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (!isAuthenticated || !user) {
        router.replace("/welcome");
      } else if (!user.role) {
        router.replace("/select-role");
      } else if (user.role === "client") {
        router.replace("/(client)/home");
      } else if (user.role === "technician") {
        router.replace("/(tech)/map");
      } else if (user.role === "admin") {
        router.replace("/(admin)/(tabs)/dashboard");
      } else {
        router.replace("/welcome");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, user]);

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
