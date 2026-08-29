import type { User } from "@/context/AppContext";
import type { AddressValue } from "@/components/AddressBlock";

const EMPTY_ADDRESS: AddressValue = {
  governorateId: "",
  governorateName: "",
  areaId: "",
  areaName: "",
  street: "",
  buildingNo: "",
  floorNo: "",
  aptNo: "",
  latitude: null,
  longitude: null,
};

export function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function currentTimeHhMm(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function timePeriodLabel(hhmm: string, isRTL: boolean): string {
  const hour = Number(hhmm.split(":")[0] || 0);
  const isDay = hour >= 6 && hour < 18;
  return isRTL ? (isDay ? "نهاراً" : "ليلاً") : isDay ? "Day" : "Night";
}

/** Build step-2 address defaults from the signed-in client profile. */
export function defaultAddressFromUser(user: User | null, isRTL: boolean): AddressValue {
  if (!user?.governorate && !user?.area) return { ...EMPTY_ADDRESS };

  const govName = isRTL
    ? user.governorateNameAr ?? user.governorate ?? ""
    : user.governorateNameEn ?? user.governorate ?? "";
  const areaName = isRTL
    ? user.areaNameAr ?? user.area ?? ""
    : user.areaNameEn ?? user.area ?? "";

  const extended = user as User & {
    street?: string;
    building?: string;
    floor?: string;
    apartment?: string;
    latitude?: number | null;
    longitude?: number | null;
  };

  return {
    governorateId: user.governorate ?? "",
    governorateName: govName,
    areaId: user.area ?? "",
    areaName,
    street: extended.street ?? user.address ?? "",
    buildingNo: extended.building ?? "",
    floorNo: extended.floor ?? "",
    aptNo: extended.apartment ?? "",
    latitude: extended.latitude ?? null,
    longitude: extended.longitude ?? null,
  };
}
