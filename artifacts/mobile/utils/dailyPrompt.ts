import AsyncStorage from "@react-native-async-storage/async-storage";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns true if the prompt may be shown today (not yet shown). */
export async function shouldShowDailyPrompt(storageKey: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(storageKey);
  return stored !== todayKey();
}

/** Mark the prompt as shown for today. */
export async function markDailyPromptShown(storageKey: string): Promise<void> {
  await AsyncStorage.setItem(storageKey, todayKey());
}
