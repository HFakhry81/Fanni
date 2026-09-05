import { Platform } from "react-native";
import { appendImageToFormData } from "../appendImageToFormData";

describe("appendImageToFormData", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS });
    jest.restoreAllMocks();
  });

  it("appends native-style payload on iOS and Android", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    const formData = new FormData();
    const appendSpy = jest.spyOn(formData, "append");

    await appendImageToFormData(formData, "photo", "file:///tmp/a.jpg", "image/jpeg");

    expect(appendSpy).toHaveBeenCalledWith(
      "photo",
      expect.objectContaining({
        uri: "file:///tmp/a.jpg",
        type: "image/jpeg",
        name: "photo.jpg",
      }),
    );
  });

  it("normalizes Android image/jpg to image/jpeg", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    const formData = new FormData();
    const appendSpy = jest.spyOn(formData, "append");

    await appendImageToFormData(formData, "photo", "file:///tmp/a.jpg", "image/jpg");

    expect(appendSpy).toHaveBeenCalledWith(
      "photo",
      expect.objectContaining({
        type: "image/jpeg",
        name: "photo.jpg",
      }),
    );
  });

  it("fetches blob and appends a File on web", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const blob = new Blob(["x"], { type: "image/png" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => blob,
    }) as jest.Mock;

    const formData = new FormData();
    const appendSpy = jest.spyOn(formData, "append");

    await appendImageToFormData(formData, "idCard", "blob:abc", "image/png", "id.png");

    expect(global.fetch).toHaveBeenCalledWith("blob:abc");
    expect(appendSpy).toHaveBeenCalledWith("idCard", expect.any(File), "id.png");
  });

  it("throws when web fetch fails", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as jest.Mock;

    const formData = new FormData();
    await expect(
      appendImageToFormData(formData, "photo", "blob:missing", "image/jpeg"),
    ).rejects.toThrow("Could not read selected image (404)");
  });
});
