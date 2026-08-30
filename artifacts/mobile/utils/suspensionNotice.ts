import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "fanni.suspensionNotice";

export async function saveSuspensionNotice(reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) return;
  await AsyncStorage.setItem(STORAGE_KEY, trimmed);
}

export async function getSuspensionNotice(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY);
}

export async function clearSuspensionNotice(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
