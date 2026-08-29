jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import { markDailyPromptShown, shouldShowDailyPrompt } from "../dailyPrompt";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("dailyPrompt", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("allows prompt before it was shown today", async () => {
    await expect(shouldShowDailyPrompt("test.prompt")).resolves.toBe(true);
  });

  it("blocks prompt after marking shown today", async () => {
    await markDailyPromptShown("test.prompt");
    await expect(shouldShowDailyPrompt("test.prompt")).resolves.toBe(false);
  });
});
