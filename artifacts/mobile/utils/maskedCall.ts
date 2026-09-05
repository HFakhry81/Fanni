import { Alert } from "react-native";
import { getApiBase } from "@/utils/api";

export type MaskedCallResult = {
  ok: boolean;
  skipped?: boolean;
  message?: string;
};

export async function startMaskedCall(opts: {
  orderId: string;
  sessionToken: string | null;
  isRTL: boolean;
}): Promise<MaskedCallResult> {
  const apiBase = getApiBase();
  if (!apiBase || !opts.sessionToken) {
    Alert.alert(opts.isRTL ? "خطأ" : "Error", opts.isRTL ? "يجب تسجيل الدخول" : "Sign in required");
    return { ok: false };
  }
  try {
    // Track contact intent so refund policy knows a call was attempted
    void fetch(`${apiBase}/api/orders/${opts.orderId}/unlock/track`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.sessionToken}` },
      body: JSON.stringify({ action: "call" }),
    }).catch(() => undefined);

    const res = await fetch(`${apiBase}/api/orders/${opts.orderId}/masked-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.sessionToken}` },
    });
    const json = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      skipped?: boolean;
      success?: boolean;
      code?: string;
    };

    if (res.ok && (json.skipped || json.code === "MASKED_CALL_UNAVAILABLE")) {
      Alert.alert(
        opts.isRTL ? "أكمل التواصل" : "Continue contact",
        json.message ??
          (opts.isRTL
            ? "الاتصال المقنّع غير مفعّل. استخدم واتساب أو الاتصال العادي — الرحلة مستمرة."
            : "Masked calling is offline. Use WhatsApp or a normal call — the journey continues."),
      );
      return { ok: true, skipped: true, message: json.message };
    }

    if (!res.ok) {
      Alert.alert(
        opts.isRTL ? "الاتصال المقنّع" : "Masked call",
        json.message ?? json.error ?? (opts.isRTL ? "تعذر بدء الاتصال" : "Could not start the call"),
      );
      return { ok: false, message: json.message ?? json.error };
    }

    Alert.alert(
      opts.isRTL ? "الاتصال المقنّع" : "Masked call",
      json.message ??
        (opts.isRTL
          ? "هيتصل بيك رقم المنصة دلوقتي. ارفع السماعة."
          : "The platform will call you now. Please answer."),
    );
    return { ok: true, message: json.message };
  } catch {
    Alert.alert(opts.isRTL ? "خطأ" : "Error", opts.isRTL ? "خطأ في الاتصال" : "Connection error");
    return { ok: false };
  }
}
