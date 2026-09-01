import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { timePeriodLabel } from "@/utils/orderDefaults";
import {
  addMinutes,
  clampTime,
  pad2,
  setHour,
  setMinute,
} from "@/utils/workHours";

type Props = {
  visible: boolean;
  title: string;
  value: string;
  onConfirm: (hhmm: string) => void;
  onCancel: () => void;
  presets?: string[];
};

/**
 * Bottom sheet for picking work hours — presets + hour/minute steppers only.
 * No native DateTimePicker (avoids duplicate spinners and web overlap).
 */
export default function WorkHoursPickerSheet({
  visible,
  title,
  value,
  onConfirm,
  onCancel,
  presets = ["08:00", "09:00", "10:00", "16:00", "18:00", "22:00"],
}: Props) {
  const colors = useColors();
  const { isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(clampTime(value || "08:00"));

  useEffect(() => {
    if (visible) setDraft(clampTime(value || "08:00"));
  }, [visible, value]);

  if (!visible) return null;

  const [hour, minute] = draft.split(":").map(Number);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={12} accessibilityRole="button">
              <Text style={[styles.cancel, { color: colors.mutedForeground }]}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.preview, { color: colors.primary }]}>
            {draft}
          </Text>
          <Text style={[styles.period, { color: colors.mutedForeground }]}>
            {timePeriodLabel(draft, isRTL)}
          </Text>

          <View style={[styles.columns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <TimeColumn
              label={isRTL ? "الساعة" : "Hour"}
              value={pad2(hour)}
              onMinus={() => setDraft((t) => setHour(t, hour - 1))}
              onPlus={() => setDraft((t) => setHour(t, hour + 1))}
              colors={colors}
            />
            <Text style={[styles.colon, { color: colors.foreground }]}>:</Text>
            <TimeColumn
              label={isRTL ? "الدقيقة" : "Minute"}
              value={pad2(minute)}
              onMinus={() => setDraft((t) => addMinutes(t, -15))}
              onPlus={() => setDraft((t) => addMinutes(t, 15))}
              colors={colors}
            />
          </View>

          <View style={[styles.minuteQuick, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {[0, 15, 30, 45].map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setDraft((t) => setMinute(t, m))}
                style={[
                  styles.minuteChip,
                  {
                    borderColor: minute === m ? colors.primary : colors.border,
                    backgroundColor: minute === m ? colors.accent : colors.muted,
                  },
                ]}
              >
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  :{pad2(m)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.presets, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {presets.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setDraft(p)}
                style={[
                  styles.preset,
                  {
                    borderColor: draft === p ? colors.primary : colors.border,
                    backgroundColor: draft === p ? colors.accent : colors.muted,
                  },
                ]}
              >
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => onConfirm(draft)}
            style={[styles.confirm, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.confirmText}>
              {isRTL ? `تأكيد ${draft}` : `Confirm ${draft}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function TimeColumn({
  label,
  value,
  onMinus,
  onPlus,
  colors,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.column}>
      <Text style={[styles.columnLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.columnControls}>
        <TouchableOpacity
          onPress={onMinus}
          style={[styles.stepBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${label} minus`}
        >
          <Text style={[styles.stepBtnText, { color: colors.foreground }]}>−</Text>
        </TouchableOpacity>
        <Text style={[styles.columnValue, { color: colors.foreground }]}>{value}</Text>
        <TouchableOpacity
          onPress={onPlus}
          style={[styles.stepBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${label} plus`}
        >
          <Text style={[styles.stepBtnText, { color: colors.foreground }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 16, flex: 1 },
  cancel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  preview: {
    fontFamily: "Inter_700Bold",
    fontSize: 42,
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 2,
  },
  period: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  columns: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  colon: { fontFamily: "Inter_700Bold", fontSize: 36, marginTop: 18 },
  column: { alignItems: "center", gap: 8, minWidth: 120 },
  columnLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  columnControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  columnValue: { fontFamily: "Inter_700Bold", fontSize: 28, minWidth: 44, textAlign: "center" },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontFamily: "Inter_700Bold", fontSize: 22 },
  minuteQuick: { flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 10 },
  minuteChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  presets: { flexWrap: "wrap", gap: 8, marginBottom: 12, justifyContent: "center" },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirm: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
});
