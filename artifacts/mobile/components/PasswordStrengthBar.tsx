import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

export interface PasswordStrength {
  score: number;
  missing: string[];
  isStrong: boolean;
}

export function getPasswordStrength(password: string, isRTL: boolean): PasswordStrength {
  const missing: string[] = [];

  if (password.length < 8) {
    missing.push(isRTL ? "8 أحرف على الأقل" : "At least 8 characters");
  }
  if (!/[a-z]/.test(password)) {
    missing.push(isRTL ? "حرف صغير" : "A lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    missing.push(isRTL ? "حرف كبير" : "An uppercase letter");
  }
  if (!/[0-9]/.test(password)) {
    missing.push(isRTL ? "رقم" : "A number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    missing.push(isRTL ? "رمز خاص (!@#...)" : "A special character (!@#...)");
  }

  const score = 5 - missing.length;

  return {
    score,
    missing,
    isStrong: missing.length === 0,
  };
}

interface Props {
  password: string;
  /** Show requirements even when password is empty */
  alwaysShow?: boolean;
}

const SEGMENT_COLORS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#16A34A"];

export default function PasswordStrengthBar({ password, alwaysShow = false }: Props) {
  const colors = useColors();
  const { isRTL } = useApp();

  if (!password && !alwaysShow) return null;

  const { score, missing } = getPasswordStrength(password, isRTL);

  const label = !password
    ? (isRTL ? "المتطلبات" : "Requirements")
    : score <= 1
      ? isRTL ? "ضعيف جداً" : "Very Weak"
      : score === 2
      ? isRTL ? "ضعيف" : "Weak"
      : score === 3
      ? isRTL ? "متوسط" : "Fair"
      : score === 4
      ? isRTL ? "جيد" : "Good"
      : isRTL ? "قوي" : "Strong";

  const barColor = password ? SEGMENT_COLORS[Math.max(0, score - 1)] : colors.border;

  return (
    <View style={styles.container}>
      {!!password && (
        <View style={[styles.barRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.segment,
                {
                  backgroundColor: i <= score ? barColor : colors.border,
                  marginLeft: isRTL ? 0 : i === 1 ? 0 : 4,
                  marginRight: isRTL ? (i === 1 ? 0 : 4) : 0,
                },
              ]}
            />
          ))}
          <Text
            style={[
              styles.label,
              {
                color: barColor,
                marginLeft: isRTL ? 0 : 8,
                marginRight: isRTL ? 8 : 0,
              },
            ]}
          >
            {label}
          </Text>
        </View>
      )}

      {(missing.length > 0 || !password) && (
        <View style={[styles.hintRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text
            style={[
              styles.hintText,
              { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {isRTL
              ? "كلمة المرور يجب أن تحتوي: 8 أحرف · حرف كبير · حرف صغير · رقم · رمز خاص (!@#)"
              : "Password must include: 8+ chars · uppercase · lowercase · number · special (!@#)"}
            {password && missing.length > 0
              ? `\n${isRTL ? "ناقص الآن: " : "Still missing: "}${missing.join(isRTL ? " · " : " · ")}`
              : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
  },
  barRow: {
    alignItems: "center",
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    width: 56,
    textAlign: "center",
  },
  hintRow: {
    marginTop: 5,
    flexWrap: "wrap",
  },
  hintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    flexShrink: 1,
  },
});
