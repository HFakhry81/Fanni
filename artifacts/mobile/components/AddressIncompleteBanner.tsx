import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { isAddressComplete } from "@/utils/addressCompleteness";
import { shouldShowDailyPrompt, markDailyPromptShown } from "@/utils/dailyPrompt";
import VectorIcon from "@/components/VectorIcon";

const PROMPT_KEY_PREFIX = "fanni.address_incomplete";

export default function AddressIncompleteBanner() {
  const colors = useColors();
  const { user, isRTL } = useApp();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const check = useCallback(async () => {
    if (!user?.id) {
      setVisible(false);
      return;
    }
    const complete = isAddressComplete({
      governorate: user.governorate,
      area: user.area,
      latitude: user.latitude,
      longitude: user.longitude,
    });
    if (complete) {
      setVisible(false);
      return;
    }
    const show = await shouldShowDailyPrompt(`${PROMPT_KEY_PREFIX}:${user.id}`);
    setVisible(show);
  }, [user]);

  useEffect(() => {
    void check();
  }, [check]);

  if (!visible || !user) return null;

  const isTech = user.type === "technician";
  const profileRoute = isTech ? "/(tech)/profile" : "/(client)/profile";

  return (
    <View style={[styles.wrap, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
      <VectorIcon name="alert-triangle" size={18} color="#B45309" />
      <Text style={[styles.text, { color: "#92400E", textAlign: isRTL ? "right" : "left" }]}>
        {isRTL
          ? "بيانات العنوان غير مكتملة (المحافظة، المنطقة، والموقع على الخريطة). أكملها لتحسين مطابقة الطلبات."
          : "Your address is incomplete (governorate, area, and map pin). Complete it for better order matching."}
      </Text>
      <TouchableOpacity
        onPress={async () => {
          await markDailyPromptShown(`${PROMPT_KEY_PREFIX}:${user.id}`);
          setVisible(false);
          router.push(profileRoute as never);
        }}
        style={[styles.btn, { backgroundColor: colors.primary }]}
      >
        <Text style={styles.btnText}>{isRTL ? "إكمال العنوان" : "Complete address"}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={async () => {
          await markDailyPromptShown(`${PROMPT_KEY_PREFIX}:${user.id}`);
          setVisible(false);
        }}
      >
        <Text style={{ color: "#92400E", fontSize: 12, fontFamily: "Inter_500Medium" }}>
          {isRTL ? "لاحقاً" : "Later"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  text: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
  btn: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
