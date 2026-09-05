import type { User } from "@/context/AppContext";
import type { AddressValue } from "@/components/AddressBlock";
import { deserializeAddress } from "@/utils/addressHelpers";
export {
  formatDateYmd,
  formatVisitDateDisplay,
  formatCreatedAtDisplay,
  isValidVisitDateYmd,
  parseVisitDateYmd,
  currentTimeHhMm,
  timePeriodLabel,
} from "@/utils/dateDisplay";

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

/** Build step-2 address defaults from the signed-in client profile. */
export function defaultAddressFromUser(user: User | null, isRTL: boolean): AddressValue {
  if (!user) return { ...EMPTY_ADDRESS };
  if (!user.governorate && !user.area && !user.street && !user.address && user.latitude == null) {
    return { ...EMPTY_ADDRESS };
  }

  const govName = isRTL
    ? user.governorateNameAr ?? user.governorate ?? ""
    : user.governorateNameEn ?? user.governorate ?? "";
  const areaName = isRTL
    ? user.areaNameAr ?? user.area ?? ""
    : user.areaNameEn ?? user.area ?? "";

  const fromJoined = deserializeAddress(user.address ?? "");

  return {
    governorateId: user.governorate ?? "",
    governorateName: govName,
    areaId: user.area ?? "",
    areaName,
    street: user.street?.trim() || fromJoined.street || "",
    buildingNo: user.buildingNo?.trim() || fromJoined.building || "",
    floorNo: user.floorNo?.trim() || fromJoined.floor || "",
    aptNo: user.aptNo?.trim() || fromJoined.apartment || "",
    latitude: user.latitude ?? null,
    longitude: user.longitude ?? null,
  };
}
