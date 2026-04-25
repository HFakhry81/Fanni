import React from "react";
import { View, Text, StyleSheet } from "react-native";
import VectorIcon from "@/components/VectorIcon";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Status = "pending" | "accepted" | "inProgress" | "completed" | "cancelled";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<string, { icon: string; bg: string; text: string; border: string }> = {
  pending:    { icon: "clock",        bg: "#FFF3DC", text: "#D4840A", border: "#F5A623" },
  accepted:   { icon: "check-circle", bg: "#E4F4FB", text: "#2B8FBB", border: "#4DADD9" },
  inProgress: { icon: "zap",          bg: "#EDE9FE", text: "#6C4FBB", border: "#9B7FE6" },
  completed:  { icon: "check-square", bg: "#D4EDDA", text: "#1A7A4A", border: "#22A36B" },
  cancelled:  { icon: "x-circle",     bg: "#FFE6E6", text: "#C0392B", border: "#E53E3E" },
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending:    { ar: "في الانتظار", en: "Pending" },
  accepted:   { ar: "مقبول",       en: "Accepted" },
  inProgress: { ar: "جاري التنفيذ",en: "In Progress" },
  completed:  { ar: "مكتمل",       en: "Completed" },
  cancelled:  { ar: "ملغي",        en: "Cancelled" },
};

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const { isRTL } = useApp();
  const colors = useColors();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["pending"];
  const labels = STATUS_LABELS[status] ?? { ar: status, en: status };
  const label = isRTL ? labels.ar : labels.en;
  const isSm = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: cfg.bg,
          borderColor: cfg.border,
          paddingVertical: isSm ? 4 : 6,
          paddingHorizontal: isSm ? 9 : 13,
          borderRadius: isSm ? 8 : 10,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
      ]}
    >
      <VectorIcon name={cfg.icon} size={isSm ? 11 : 13} color={cfg.text} />
      <Text
        style={{
          color: cfg.text,
          fontFamily: "Inter_600SemiBold",
          fontSize: isSm ? 11 : 12,
          marginLeft: isRTL ? 0 : 4,
          marginRight: isRTL ? 4 : 0,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", borderWidth: 1.5 },
});
