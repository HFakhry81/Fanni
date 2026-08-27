import { getApiBase } from "./api";
import { appendImageToFormData } from "./appendImageToFormData";

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
  formData.append("purpose", purpose);
  await appendImageToFormData(formData, "file", fileUri, mimeType);

  const res = await fetch(`${apiBase}/api/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }

  const data = (await res.json()) as { url: string };
  if (!data.url) throw new Error("Server returned no URL");
  const absolute = data.url.startsWith("http")
    ? data.url
    : `${apiBase.replace(/\/$/, "")}${data.url.startsWith("/") ? data.url : `/${data.url}`}`;
  return { url: absolute };
}
