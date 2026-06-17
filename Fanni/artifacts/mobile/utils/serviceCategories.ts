export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  electricity: ["electrician", "electric", "electrical", "كهرباء", "كهربائي"],
  plumbing: ["plumber", "plumbing", "سباكة", "سباك"],
  ac: ["ac", "air conditioning", "hvac", "تكييف", "مكيفات"],
  carpentry: ["carpenter", "carpentry", "نجارة", "نجار"],
  appliances: ["appliances", "appliance", "electronics", "أجهزة"],
  painting: ["painting", "painter", "دهانات", "دهان"],
  pest: ["pest", "pest control", "حشرات", "مكافحة"],
  flooring: ["flooring", "floor", "tiles", "أرضيات", "بلاط"],
};

export function professionToCategory(profession: string): string | undefined {
  const lower = profession.trim().toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return undefined;
}
