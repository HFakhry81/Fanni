import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function timeStringToDate(hhmm: string): Date {
  const [h, m] = (hhmm || "08:00").split(":").map((x) => Number(x) || 0);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function dateToTimeString(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function clampTime(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Math.min(23, Math.max(0, Number(hRaw) || 0));
  const m = Math.min(59, Math.max(0, Number(mRaw) || 0));
  return `${pad2(h)}:${pad2(m)}`;
}

function addMinutes(hhmm: string, delta: number): string {
  const [h, m] = clampTime(hhmm).split(":").map(Number);
  let total = h * 60 + m + delta;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

type Props = {
  visible: boolean;
  title: string;
  value: string;
  onConfirm: (hhmm: string) => void;
  onCancel: () => void;
  presets?: string[];
};

/**
 * Reliable work-hours sheet: steppers + optional spinner + Confirm.
 * Avoids Android DateTimePicker dialog OK quirks and accidental auto-close.
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
          // Keep touches inside the sheet from dismissing it
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

          <Text style={[styles.preview, { color: colors.primary }]}>{draft}</Text>

          <View style={[styles.stepRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Stepper
              label={isRTL ? "ساعة" : "Hour"}
              onMinus={() => setDraft((t) => addMinutes(t, -60))}
              onPlus={() => setDraft((t) => addMinutes(t, 60))}
              colors={colors}
            />
            <Stepper
              label={isRTL ? "دقيقة" : "Min"}
              onMinus={() => setDraft((t) => addMinutes(t, -15))}
              onPlus={() => setDraft((t) => addMinutes(t, 15))}
              colors={colors}
            />
          </View>

          <DateTimePicker
            mode="time"
            is24Hour
            display="spinner"
            value={timeStringToDate(draft)}
            onChange={(_e: DateTimePickerEvent, date?: Date) => {
              if (date) setDraft(dateToTimeString(date));
            }}
            style={{ width: "100%", height: Platform.OS === "ios" ? 160 : 140 }}
          />

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

function Stepper({
  label,
  onMinus,
  onPlus,
  colors,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={[styles.stepperLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.stepperBtns}>
        <TouchableOpacity
          onPress={onMinus}
          style={[styles.stepBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
          hitSlop={8}
        >
          <Text style={[styles.stepBtnText, { color: colors.foreground }]}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPlus}
          style={[styles.stepBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
          hitSlop={8}
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
    fontSize: 36,
    textAlign: "center",
    marginVertical: 8,
  },
  stepRow: { gap: 16, justifyContent: "center", marginBottom: 4 },
  stepper: { alignItems: "center", gap: 6 },
  stepperLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  stepperBtns: { flexDirection: "row", gap: 10 },
  stepBtn: {
    width: 52,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontFamily: "Inter_700Bold", fontSize: 22 },
  presets: { flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 12 },
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
