import { Alert, Platform } from "react-native";

type ConfirmButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
};

/**
 * Cross-platform confirm dialog.
 * React Native `Alert.alert` with buttons is unreliable on web — use window.confirm there.
 */
export function confirmDialog(
  title: string,
  message: string,
  buttons: ConfirmButton[],
): void {
  if (Platform.OS === "web") {
    const confirmBtn =
      buttons.find((b) => b.style === "destructive") ??
      buttons.find((b) => b.style !== "cancel") ??
      buttons[buttons.length - 1];
    const cancelBtn = buttons.find((b) => b.style === "cancel");
    const ok = typeof window !== "undefined"
      ? window.confirm([title, message].filter(Boolean).join("\n\n"))
      : false;
    void (async () => {
      if (ok) await confirmBtn?.onPress?.();
      else await cancelBtn?.onPress?.();
    })();
    return;
  }

  Alert.alert(
    title,
    message,
    buttons.map((b) => ({
      text: b.text,
      style: b.style,
      onPress: () => {
        void b.onPress?.();
      },
    })),
  );
}
