const mockStore = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStore.delete(key);
    }),
    clear: jest.fn(async () => {
      mockStore.clear();
    }),
  },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AUTH_TOKEN_KEY,
  deleteAuthToken,
  getAuthToken,
  setAuthToken,
} from "./authTokenStorage";

describe("authTokenStorage (web)", () => {
  const originalOS = Platform.OS;

  beforeAll(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, get: () => "web" });
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, get: () => originalOS });
  });

  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  it("stores and reads token via AsyncStorage on web", async () => {
    await setAuthToken("tok-web-1");
    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBe("tok-web-1");
    expect(await getAuthToken()).toBe("tok-web-1");
  });

  it("deletes token on web", async () => {
    await setAuthToken("tok-web-2");
    await deleteAuthToken();
    expect(await getAuthToken()).toBeNull();
  });
});
