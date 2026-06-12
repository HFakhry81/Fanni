/**
 * egyptLocations.ts
 * بيانات المحافظات المصرية مع الإحداثيات لتحريك كاميرا الخريطة
 * ملاحظة: أسماء المحافظات والمناطق تأتي من API (/api/locations/*)
 * هذا الملف يحتوي فقط على إحداثيات المراكز لأغراض الخريطة
 */

export interface GovCoordinate {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lng: number;
  latitudeDelta: number;
  longitudeDelta: number;
  aliases: string[];
}

export const EGYPT_GOV_COORDINATES: GovCoordinate[] = [
  { id: "cairo",        nameAr: "القاهرة",       nameEn: "Cairo",         lat: 30.0444, lng: 31.2357, latitudeDelta: 0.40, longitudeDelta: 0.40, aliases: ["cairo","al qahirah","القاهره","قاهرة"] },
  { id: "alexandria",   nameAr: "الإسكندرية",    nameEn: "Alexandria",    lat: 31.2001, lng: 29.9187, latitudeDelta: 0.30, longitudeDelta: 0.30, aliases: ["alex","alexandria","الاسكندرية","الإسكندريه","اسكندرية","إسكندرية"] },
  { id: "giza",         nameAr: "الجيزة",        nameEn: "Giza",          lat: 30.0131, lng: 31.2089, latitudeDelta: 0.50, longitudeDelta: 0.50, aliases: ["giza","el giza","الجيزه","جيزة"] },
  { id: "port_said",    nameAr: "بورسعيد",       nameEn: "Port Said",     lat: 31.2653, lng: 32.3019, latitudeDelta: 0.25, longitudeDelta: 0.25, aliases: ["port said","بور سعيد"] },
  { id: "suez",         nameAr: "السويس",        nameEn: "Suez",          lat: 29.9668, lng: 32.5498, latitudeDelta: 0.30, longitudeDelta: 0.30, aliases: ["suez","سويس"] },
  { id: "luxor",        nameAr: "الأقصر",        nameEn: "Luxor",         lat: 25.6872, lng: 32.6396, latitudeDelta: 0.30, longitudeDelta: 0.30, aliases: ["luxor","الاقصر","اقصر"] },
  { id: "aswan",        nameAr: "أسوان",         nameEn: "Aswan",         lat: 24.0889, lng: 32.8998, latitudeDelta: 0.30, longitudeDelta: 0.30, aliases: ["aswan","اسوان"] },
  { id: "asyut",        nameAr: "أسيوط",         nameEn: "Asyut",         lat: 27.1809, lng: 31.1837, latitudeDelta: 0.35, longitudeDelta: 0.35, aliases: ["asyut","assiut","اسيوط"] },
  { id: "beni_suef",    nameAr: "بني سويف",      nameEn: "Beni Suef",     lat: 29.0661, lng: 31.0994, latitudeDelta: 0.35, longitudeDelta: 0.35, aliases: ["beni suef","بنى سويف"] },
  { id: "fayoum",       nameAr: "الفيوم",        nameEn: "Faiyum",        lat: 29.3084, lng: 30.8428, latitudeDelta: 0.40, longitudeDelta: 0.40, aliases: ["faiyum","fayoum","الفيوم"] },
  { id: "dakahlia",     nameAr: "الدقهلية",      nameEn: "Dakahlia",      lat: 31.1656, lng: 31.4913, latitudeDelta: 0.60, longitudeDelta: 0.60, aliases: ["dakahlia","الدقهليه"] },
  { id: "damietta",     nameAr: "دمياط",         nameEn: "Damietta",      lat: 31.4165, lng: 31.8133, latitudeDelta: 0.30, longitudeDelta: 0.30, aliases: ["damietta","dumyat"] },
  { id: "sharqia",      nameAr: "الشرقية",       nameEn: "Sharqia",       lat: 30.7367, lng: 31.7232, latitudeDelta: 0.70, longitudeDelta: 0.70, aliases: ["sharqia","الشرقيه"] },
  { id: "ismailia",     nameAr: "الإسماعيلية",   nameEn: "Ismailia",      lat: 30.5965, lng: 32.2715, latitudeDelta: 0.35, longitudeDelta: 0.35, aliases: ["ismailia","الاسماعيلية"] },
  { id: "menoufia",     nameAr: "المنوفية",      nameEn: "Menoufia",      lat: 30.5973, lng: 30.9876, latitudeDelta: 0.50, longitudeDelta: 0.50, aliases: ["menoufia","المنوفيه"] },
  { id: "qalyubia",     nameAr: "القليوبية",     nameEn: "Qalyubia",      lat: 30.3292, lng: 31.2168, latitudeDelta: 0.50, longitudeDelta: 0.50, aliases: ["qalyubia","القليوبيه"] },
  { id: "kafr_sheikh",  nameAr: "كفر الشيخ",     nameEn: "Kafr El Sheikh",lat: 31.1107, lng: 30.9388, latitudeDelta: 0.50, longitudeDelta: 0.50, aliases: ["kafr el sheikh","كفر الشيخ"] },
  { id: "beheira",      nameAr: "البحيرة",       nameEn: "Beheira",       lat: 30.8480, lng: 30.3442, latitudeDelta: 0.70, longitudeDelta: 0.70, aliases: ["beheira","البحيره"] },
  { id: "gharbia",      nameAr: "الغربية",       nameEn: "Gharbia",       lat: 30.8748, lng: 31.0326, latitudeDelta: 0.50, longitudeDelta: 0.50, aliases: ["gharbia","الغربيه"] },
  { id: "matrouh",      nameAr: "مطروح",         nameEn: "Matrouh",       lat: 31.3543, lng: 27.2373, latitudeDelta: 2.00, longitudeDelta: 2.00, aliases: ["matrouh","مطروح"] },
  { id: "north_sinai",  nameAr: "شمال سيناء",    nameEn: "North Sinai",   lat: 30.9280, lng: 33.7968, latitudeDelta: 1.50, longitudeDelta: 1.50, aliases: ["north sinai","شمال سيناء"] },
  { id: "south_sinai",  nameAr: "جنوب سيناء",    nameEn: "South Sinai",   lat: 28.2122, lng: 33.6056, latitudeDelta: 2.00, longitudeDelta: 2.00, aliases: ["south sinai","جنوب سيناء"] },
  { id: "red_sea",      nameAr: "البحر الأحمر",  nameEn: "Red Sea",       lat: 26.8206, lng: 33.8116, latitudeDelta: 2.50, longitudeDelta: 2.50, aliases: ["red sea","البحر الاحمر"] },
  { id: "new_valley",   nameAr: "الوادي الجديد", nameEn: "New Valley",    lat: 24.5456, lng: 28.7854, latitudeDelta: 3.00, longitudeDelta: 3.00, aliases: ["new valley","الوادى الجديد"] },
  { id: "sohag",        nameAr: "سوهاج",         nameEn: "Sohag",         lat: 26.5590, lng: 31.6957, latitudeDelta: 0.50, longitudeDelta: 0.50, aliases: ["sohag","سوهاج"] },
  { id: "qena",         nameAr: "قنا",           nameEn: "Qena",          lat: 26.1551, lng: 32.7160, latitudeDelta: 0.50, longitudeDelta: 0.50, aliases: ["qena","قنا"] },
  { id: "minya",        nameAr: "المنيا",        nameEn: "Minya",         lat: 28.0871, lng: 30.7618, latitudeDelta: 0.50, longitudeDelta: 0.50, aliases: ["minya","المنيا"] },
];

export const EGYPT_CENTER   = { lat: 26.8206, lng: 30.8025, latitudeDelta: 12.0, longitudeDelta: 12.0 };
export const ALEXANDRIA_CENTER = { lat: 31.2001, lng: 29.9187, latitudeDelta: 0.25, longitudeDelta: 0.25 };

export function getGovById(id: string): GovCoordinate | undefined {
  return EGYPT_GOV_COORDINATES.find((g) => g.id === id);
}
