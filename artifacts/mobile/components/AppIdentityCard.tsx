import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import {
  APP_IDENTITY,
  getAppVersionLabel,
} from "@/constants/appIdentity";

/** Compact publisher + version block for profile / about / wallet surfaces. */
export default function AppIdentityCard() {
  const colors = useColors();
  const { isRTL, t } = useApp();
  const align = isRTL ? "right" : "left" as const;

  const open = (url: string) => {
    void Linking.openURL(url);
  };

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
      <Text style={[styles.product, { color: colors.foreground, textAlign: align }]}>
        {isRTL
          ? `${APP_IDENTITY.productNameAr} — ${APP_IDENTITY.productTaglineAr}`
          : `${APP_IDENTITY.productNameEn} — ${APP_IDENTITY.productTaglineEn}`}
      </Text>
      <Text style={[styles.line, { color: colors.mutedForeground, textAlign: align }]}>
        {isRTL ? APP_IDENTITY.companyLegalAr : APP_IDENTITY.companyLegalEn}
      </Text>
      <Text style={[styles.line, { color: colors.mutedForeground, textAlign: align }]}>
        {isRTL ? APP_IDENTITY.companyTaglineAr : APP_IDENTITY.companyTaglineEn}
      </Text>
      <Text style={[styles.line, { color: colors.mutedForeground, textAlign: align }]}>
        {t("about.version")}: {getAppVersionLabel()}
      </Text>
      <Text style={[styles.line, { color: colors.mutedForeground, textAlign: align }]}>
        {isRTL ? "معرّف الحزمة" : "Package"}: {APP_IDENTITY.packageId}
      </Text>
      <Text style={[styles.line, { color: colors.mutedForeground, textAlign: align }]}>
        {isRTL ? "الناشر" : "Publisher"}: {APP_IDENTITY.companyNameEn} ({APP_IDENTITY.publisherDomain})
      </Text>
      <TouchableOpacity onPress={() => open(`mailto:${APP_IDENTITY.supportEmail}`)} activeOpacity={0.7}>
        <Text style={[styles.link, { color: colors.primary, textAlign: align }]}>
          {APP_IDENTITY.supportEmail}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => open(APP_IDENTITY.website)} activeOpacity={0.7}>
        <Text style={[styles.link, { color: colors.primary, textAlign: align }]}>
          {APP_IDENTITY.website.replace(/^https:\/\//, "")}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => open(APP_IDENTITY.apiUrl)} activeOpacity={0.7}>
        <Text style={[styles.link, { color: colors.primary, textAlign: align }]}>
          API: {APP_IDENTITY.apiUrl.replace(/^https:\/\//, "")}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => open(APP_IDENTITY.appDownloadUrl)} activeOpacity={0.7}>
        <Text style={[styles.link, { color: colors.primary, textAlign: align }]}>
          {isRTL ? "تحميل التطبيق" : "Download app"}: {APP_IDENTITY.appWebHost}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => open(isRTL ? APP_IDENTITY.termsTechUrl : APP_IDENTITY.termsClientUrl)}
        activeOpacity={0.7}
      >
        <Text style={[styles.link, { color: colors.primary, textAlign: align }]}>
          {isRTL ? "شروط الاستخدام" : "Terms of use"}
        </Text>
      </TouchableOpacity>
      <Text style={[styles.copy, { color: colors.mutedForeground, textAlign: align }]}>
        {isRTL ? APP_IDENTITY.copyrightAr : APP_IDENTITY.copyrightEn}
      </Text>
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
  product: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
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
  copy: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 4,
  },
});
