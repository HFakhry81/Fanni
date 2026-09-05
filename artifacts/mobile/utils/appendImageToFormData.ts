import { Platform } from "react-native";

function normalizeMime(mimeType: string, fileUri: string): string {
  const raw = (mimeType || "").trim().toLowerCase();
  if (raw === "image/jpg" || raw === "image/pjpeg" || raw === "image/jpeg") return "image/jpeg";
  if (raw === "image/png" || raw === "image/x-png") return "image/png";
  if (raw === "image/webp") return "image/webp";
  const uri = fileUri.toLowerCase();
  if (uri.includes(".png") || uri.startsWith("data:image/png")) return "image/png";
  if (uri.includes(".webp") || uri.startsWith("data:image/webp")) return "image/webp";
  return "image/jpeg";
}

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
  const type = normalizeMime(mimeType, fileUri);
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const name = fileName ?? `photo.${ext}`;

  if (Platform.OS === "web") {
    const res = await fetch(fileUri);
    if (!res.ok) {
      throw new Error(`Could not read selected image (${res.status})`);
    }
    const blob = await res.blob();
    const resolvedType = normalizeMime(blob.type || type, fileUri);
    const file =
      typeof File !== "undefined"
        ? new File([blob], name, { type: resolvedType })
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
