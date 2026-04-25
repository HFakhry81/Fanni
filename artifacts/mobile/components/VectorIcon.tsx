import React from "react";
import { Text, type TextStyle } from "react-native";

const ICON_MAP: Record<string, string> = {
  "activity":       "📈",
  "alert-circle":   "⚠",
  "alert-triangle": "⚠",
  "arrow-left":     "←",
  "arrow-right":    "→",
  "award":          "🏆",
  "bar-chart-2":    "📊",
  "bell":           "🔔",
  "calendar":       "📅",
  "camera":         "📷",
  "check":          "✓",
  "check-circle":   "✓",
  "chevron-down":   "▾",
  "chevron-left":   "‹",
  "chevron-right":  "›",
  "chevron-up":     "▴",
  "clipboard":      "📋",
  "clock":          "🕐",
  "cpu":            "⚙",
  "credit-card":    "💳",
  "dollar-sign":    "$",
  "droplet":        "💧",
  "edit-2":         "✏",
  "edit-3":         "✏",
  "eye":            "👁",
  "eye-off":        "⊘",
  "file-text":      "📄",
  "frown":          "😞",
  "globe":          "🌐",
  "grid":           "⊞",
  "home":           "🏠",
  "image":          "🖼",
  "inbox":          "📥",
  "list":           "☰",
  "loader":         "⟳",
  "lock":           "🔒",
  "log-out":        "↩",
  "mail":           "✉",
  "map-pin":        "📍",
  "maximize-2":     "⛶",
  "meh":            "😐",
  "message-circle": "💬",
  "minus":          "−",
  "phone":          "📞",
  "plus":           "+",
  "plus-circle":    "⊕",
  "refresh-cw":     "↺",
  "save":           "💾",
  "search":         "🔍",
  "send":           "↑",
  "settings":       "⚙",
  "share-2":        "↑",
  "shield":         "🛡",
  "slash":          "⊘",
  "smartphone":     "📱",
  "smile":          "😊",
  "star":           "★",
  "tag":            "🏷",
  "toggle-left":    "○",
  "toggle-right":   "●",
  "tool":           "🔧",
  "trash-2":        "🗑",
  "user":           "👤",
  "user-plus":      "👤",
  "users":          "👥",
  "wifi":           "📶",
  "wifi-off":       "📵",
  "wind":           "🌬",
  "x":              "✕",
  "x-circle":       "✕",
  "zap":            "⚡",
};

interface VectorIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: TextStyle;
}

export default function VectorIcon({ name, size = 16, color, style }: VectorIconProps) {
  const symbol = ICON_MAP[name] ?? "•";
  return (
    <Text
      style={[
        { fontSize: size, color: color ?? "#000", lineHeight: size * 1.4, textAlign: "center" },
        style,
      ]}
    >
      {symbol}
    </Text>
  );
}
