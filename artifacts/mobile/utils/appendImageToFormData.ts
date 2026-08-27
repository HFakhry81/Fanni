import { Platform } from "react-native";

/**
 * Append an image to FormData in a way that works on native AND web.
 *
 * React Native accepts `{ uri, type, name }`. Browsers ignore that shape and
 * send an empty body — multer then returns "No file provided".
 * On web we fetch the blob:/https: URI and append a real Blob/File.
 */
export async function appendImageToFormData(
  formData: FormData,
  fieldName: string,
  fileUri: string,
  mimeType: string = "image/jpeg",
  fileName?: string,
): Promise<void> {
  const ext =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const name = fileName ?? `photo.${ext}`;
  const type =
    mimeType ||
    (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");

  if (Platform.OS === "web") {
    const res = await fetch(fileUri);
    if (!res.ok) {
      throw new Error(`Could not read selected image (${res.status})`);
    }
    const blob = await res.blob();
    const file =
      typeof File !== "undefined"
        ? new File([blob], name, { type: blob.type || type })
        : blob;
    formData.append(fieldName, file, name);
    return;
  }

  formData.append(fieldName, {
    uri: fileUri,
    type,
    name,
  } as unknown as Blob);
}
