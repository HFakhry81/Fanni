import React, { useCallback, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import VectorIcon from "@/components/VectorIcon";
import WorkHoursPickerSheet from "@/components/WorkHoursPickerSheet";
import { useColors } from "@/hooks/useColors";

type FieldKey = "start" | "end";

export type WorkHoursFieldGroupProps = {
  start: string;
  end: string;
  onChangeStart: (hhmm: string) => void;
  onChangeEnd: (hhmm: string) => void;
  errors?: { start?: string; end?: string };
  onClearErrors?: (field: "start" | "end" | "both") => void;
  isRTL: boolean;
  title?: string;
  description?: string;
  required?: boolean;
  style?: ViewStyle;
  startLabel?: string;
  endLabel?: string;
};

function webFocusProps() {
  if (Platform.OS !== "web") return {};
  return { tabIndex: 0 as const, accessibilityRole: "button" as const };
}

export default function WorkHoursFieldGroup({
  start,
  end,
  onChangeStart,
  onChangeEnd,
  errors,
  onClearErrors,
  isRTL,
  title,
  description,
  required = false,
  style,
  startLabel,
  endLabel,
}: WorkHoursFieldGroupProps) {
  const colors = useColors();
  const [activePicker, setActivePicker] = useState<FieldKey | null>(null);
  const [focusedField, setFocusedField] = useState<FieldKey | null>(null);

  const openPicker = useCallback((field: FieldKey) => {
    setActivePicker(field);
  }, []);

  const renderField = (field: FieldKey, value: string, label: string) => {
    const err = field === "start" ? errors?.start : errors?.end;
    const isFocused = focusedField === field;

    return (
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {label}
        </Text>
        <TouchableOpacity
          onPress={() => openPicker(field)}
          onFocus={() => setFocusedField(field)}
          onBlur={() => setFocusedField((f) => (f === field ? null : f))}
          activeOpacity={0.85}
          accessibilityLabel={label}
          {...webFocusProps()}
          style={[
            styles.field,
            {
              backgroundColor: colors.card,
              borderColor: err ? colors.destructive : isFocused ? colors.primary : colors.border,
              flexDirection: isRTL ? "row-reverse" : "row",
            },
          ]}
        >
          <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>{value}</Text>
          <VectorIcon name="clock" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        {err ? (
          <Text style={[styles.error, { color: colors.destructive, textAlign: isRTL ? "right" : "left" }]}>{err}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={style}>
      {title ? (
        <Text style={[styles.title, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {title}
          {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
        </Text>
      ) : null}
      {description ? (
        <Text style={[styles.description, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
          {description}
        </Text>
      ) : null}

      <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}>
          {renderField(
            "start",
            start,
            startLabel ?? (isRTL ? "بداية العمل" : "Work Start"),
          )}
        </View>
        <View style={{ flex: 1 }}>
          {renderField(
            "end",
            end,
            endLabel ?? (isRTL ? "نهاية العمل" : "Work End"),
          )}
        </View>
      </View>

      <WorkHoursPickerSheet
        visible={activePicker !== null}
        title={
          activePicker === "start"
            ? (isRTL ? "اختر بداية العمل" : "Pick work start")
            : (isRTL ? "اختر نهاية العمل" : "Pick work end")
        }
        value={activePicker === "start" ? start : end}
        presets={activePicker === "start" ? ["08:00", "09:00", "10:00"] : ["16:00", "18:00", "22:00"]}
        onCancel={() => setActivePicker(null)}
        onConfirm={(hhmm) => {
          if (activePicker === "start") {
            onChangeStart(hhmm);
            onClearErrors?.("both");
          } else {
            onChangeEnd(hhmm);
            onClearErrors?.("end");
          }
          setActivePicker(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  description: { fontSize: 11, marginBottom: 10, lineHeight: 16 },
  row: { gap: 0, marginBottom: 4 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  field: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "space-between",
  },
  error: { fontSize: 12, marginTop: 4 },
});
