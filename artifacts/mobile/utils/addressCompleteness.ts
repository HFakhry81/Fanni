export function isAddressComplete(fields: {
  governorate?: string | null;
  area?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  const gov = String(fields.governorate ?? "").trim();
  const area = String(fields.area ?? "").trim();
  return gov.length > 0 && area.length > 0 && fields.latitude != null && fields.longitude != null;
}
