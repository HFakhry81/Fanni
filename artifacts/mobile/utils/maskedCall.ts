import { Alert } from "react-native";
import { getApiBase } from "@/utils/api";

export async function startMaskedCall(opts: {
  orderId: string;
  sessionToken: string | null;
  isRTL: boolean;
}): Promise<void> {
  const apiBase = getApiBase();
  if (!apiBase || !opts.sessionToken) {
    Alert.alert(opts.isRTL ? "خطأ" : "Error", opts.isRTL ? "يجب تسجيل الدخول" : "Sign in required");
    return;
  }
  try {
    const res = await fetch(`${apiBase}/api/orders/${opts.orderId}/masked-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.sessionToken}` },
    });
    const json = await res.json().catch(() => ({})) as { message?: string; error?: string };
    if (!res.ok) {
      Alert.alert(
        opts.isRTL ? "الاتصال المقنّع" : "Masked call",
        json.message ?? json.error ?? (opts.isRTL ? "تعذر بدء الاتصال" : "Could not start the call"),
      );
      return;
    }
    Alert.alert(
      opts.isRTL ? "الاتصال المقنّع" : "Masked call",
      json.message ?? (opts.isRTL
        ? "هيتصل بيك رقم المنصة دلوقتي. ارفع السماعة."
        : "The platform will call you now. Please answer."),
    );
  } catch {
    Alert.alert(opts.isRTL ? "خطأ" : "Error", opts.isRTL ? "خطأ في الاتصال" : "Connection error");
  }
}
