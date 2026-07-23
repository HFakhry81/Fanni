import { Stack } from "expo-router";
import * as Sentry from "@sentry/react-native"; // 1. أضفنا الاستيراد هنا

export default function AdminLayout() {
  // 2. أضفنا سطر التجربة هنا مباشرة قبل الـ return
  Sentry.captureException(new Error("مبروك! تطبيق فني كدة متصل بـ Sentry بنجاح 🎉"));
  // أضف السطر ده قبل الـ return
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-admin" />
    </Stack>
  );
}
