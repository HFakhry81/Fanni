import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import {
  APP_IDENTITY,
  getAppVersionLabel,
} from "@/constants/appIdentity";

/** Compact publisher + version block for profile / about surfaces. */
export default function AppIdentityCard() {
  const colors = useColors();
  const { isRTL, t } = useApp();
  const align = isRTL ? "right" : "left" as const;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground, textAlign: align }]}>
        {t("about.appIdentity")}
      </Text>
      <Text style={[styles.line, { color: colors.mutedForeground, textAlign: align }]}>
        {isRTL ? APP_IDENTITY.companyLegalAr : APP_IDENTITY.companyLegalEn}
      </Text>
      <Text style={[styles.line, { color: colors.mutedForeground, textAlign: align }]}>
        {t("about.version")}: {getAppVersionLabel()}
      </Text>
      <TouchableOpacity
        onPress={() => { void Linking.openURL(`mailto:${APP_IDENTITY.supportEmail}`); }}
        activeOpacity={0.7}
      >
        <Text style={[styles.link, { color: colors.primary, textAlign: align }]}>
          {APP_IDENTITY.supportEmail}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { void Linking.openURL(APP_IDENTITY.website); }}
        activeOpacity={0.7}
      >
        <Text style={[styles.link, { color: colors.primary, textAlign: align }]}>
          {APP_IDENTITY.website.replace(/^https:\/\//, "")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginBottom: 2,
  },
  line: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  link: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
