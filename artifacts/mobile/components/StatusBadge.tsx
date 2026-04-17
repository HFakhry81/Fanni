import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const colors = useColors();
  const { t } = useApp();

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "#FFF3DC", text: "#F5A623", label: t("order.status.pending") },
    accepted: { bg: "#E6F4FF", text: "#0077CC", label: t("order.status.accepted") },
    inProgress: { bg: "#E6F0FF", text: "#4A6FFF", label: t("order.status.inProgress") },
    completed: { bg: "#E6F9F0", text: "#38A169", label: t("order.status.completed") },
    cancelled: { bg: "#FFE6E6", text: "#E53E3E", label: t("order.status.cancelled") },
  };

  const cfg = statusConfig[status] ?? statusConfig["pending"];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: cfg.bg, borderRadius: colors.radius / 2 },
      ]}
    >
      <Text style={[styles.text, { color: cfg.text, fontFamily: "Inter_600SemiBold" }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
  },
});
