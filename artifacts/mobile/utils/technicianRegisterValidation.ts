/** Technician registration: national ID card photos are mandatory. */
export function getTechnicianIdPhotosError(
  frontUri: string | null | undefined,
  backUri: string | null | undefined,
  isRTL: boolean,
): string | undefined {
  if (frontUri && backUri) return undefined;
  return isRTL
    ? "صور البطاقة (الوجه والظهر) إجبارية"
    : "National ID photos (front and back) are required";
}

export function hasRequiredTechnicianIdPhotos(
  frontUri: string | null | undefined,
  backUri: string | null | undefined,
): boolean {
  return Boolean(frontUri && backUri);
}
