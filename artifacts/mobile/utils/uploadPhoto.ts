import { getApiBase } from "./api";

export interface UploadResult {
  url: string;
}

export async function uploadPhotoToServer(
  fileUri: string,
  sessionToken: string,
  mimeType: string = "image/jpeg",
  purpose: "id" | "carnehat" | "uploads" = "uploads",
): Promise<UploadResult> {
  const apiBase = getApiBase();
  if (!apiBase) throw new Error("API base URL is not configured");

  const formData = new FormData();
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  formData.append("purpose", purpose);
  formData.append("file", {
    uri: fileUri,
    type: mimeType,
    name: `photo.${ext}`,
  } as unknown as Blob);

  const res = await fetch(`${apiBase}/api/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }

  const data = await res.json() as { url: string };
  if (!data.url) throw new Error("Server returned no URL");
  return { url: data.url };
}
