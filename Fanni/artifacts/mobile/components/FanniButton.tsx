import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

interface FanniButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export default function FanniButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  textStyle,
  size = "md",
  fullWidth = false,
}: FanniButtonProps) {
  const colors = useColors();
  const { isRTL } = useApp();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const getContainerStyle = (): ViewStyle => {
    const base: ViewStyle = {
      borderRadius: colors.radius,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: isRTL ? "row-reverse" : "row",
    };

    const sizes = {
      sm: { paddingVertical: 8, paddingHorizontal: 16 },
      md: { paddingVertical: 14, paddingHorizontal: 24 },
      lg: { paddingVertical: 18, paddingHorizontal: 32 },
    };

    const variants: Record<string, ViewStyle> = {
      primary: { backgroundColor: colors.primary },
      secondary: { backgroundColor: colors.secondary },
      outline: {
        backgroundColor: "transparent",
        borderWidth: 2,
        borderColor: colors.primary,
      },
      ghost: { backgroundColor: "transparent" },
      danger: { backgroundColor: colors.destructive },
    };

    return {
      ...base,
      ...sizes[size],
      ...variants[variant],
      ...(fullWidth ? { width: "100%" } : {}),
      opacity: disabled ? 0.5 : 1,
    };
  };

  const getTextStyle = (): TextStyle => {
    const sizes = {
      sm: { fontSize: 13, fontFamily: "Inter_500Medium" },
      md: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
      lg: { fontSize: 17, fontFamily: "Inter_700Bold" },
    };

    const variants: Record<string, TextStyle> = {
      primary: { color: colors.primaryForeground },
      secondary: { color: colors.secondaryForeground },
      outline: { color: colors.primary },
      ghost: { color: colors.primary },
      danger: { color: colors.destructiveForeground },
    };

    return {
      ...sizes[size],
      ...variants[variant],
    };
  };

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "outline" || variant === "ghost"
              ? colors.primary
              : colors.primaryForeground
          }
          size="small"
        />
      ) : (
        <Text style={[getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
