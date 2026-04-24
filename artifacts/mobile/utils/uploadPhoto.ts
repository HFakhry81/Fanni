export interface UploadResult {
  url: string;
}

export async function uploadPhotoToServer(
  fileUri: string,
  sessionToken: string,
  mimeType: string = "image/jpeg",
): Promise<UploadResult> {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  if (!domain) throw new Error("EXPO_PUBLIC_DOMAIN not configured");
  const apiBase = `https://${domain}`;

  const formData = new FormData();
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
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
