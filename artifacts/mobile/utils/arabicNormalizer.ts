/**
 * arabicNormalizer.ts
 * أدوات تطبيع النص العربي لحل مشكلة البدائل الكثيرة في الكتابة العامية
 *
 * يعالج حالات مثل:
 *   الإسكندرية / الاسكندرية / الأسكندرية / إسكندرية
 *   سيدي بشر / سيدى بشر / sidi bishr / sidi bisher
 *   العجمي / الأعجمي / agami / el agami
 */

// ─── 1. تطبيع الحروف العربية ─────────────────────────────────

/**
 * يوحّد الكتابة العربية بإزالة الفوارق غير المعنوية
 * أإآ → ا  |  ةه → ه  |  يىئ → ي  |  ؤ → و
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآ]/g, "ا")             // توحيد أشكال الألف
    .replace(/[ةه]/g, "ه")             // توحيد التاء المربوطة
    .replace(/[يىئ]/g, "ي")            // توحيد الياء وأشكالها
    .replace(/ؤ/g, "و")                // توحيد الواو مع الهمزة
    .replace(/[\u064B-\u065F\u0670]/g, "") // حذف التشكيل
    .replace(/\u0651/g, "")            // حذف الشدة
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ─── 2. تطبيع النص الإنجليزي ─────────────────────────────────

/**
 * يوحّد الكتابة اللاتينية للأسماء المصرية
 * يزيل البادئة el/al، ويوحّد الحروف الشائعة الاختلاف
 */
export function normalizeEnglish(text: string): string {
  return text
    .toLowerCase()
    .replace(/^(el[- ]|al[- ])/, "")    // حذف البادئة el/al
    .replace(/[''`]/g, "")
    .replace(/[- _]+/g, " ")
    .replace(/ph/g, "f")                // pharos → faros
    .replace(/ou/g, "u")               // Nouzha → Nuza
    .replace(/[aeiou]{2,}/g, (m) => m[0])
    .replace(/\s+/g, " ")
    .trim();
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

// ─── 3. مقياس التشابه ─────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0
    )
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * يطبّع النص بغض النظر عن لغته ثم يقيس التطابق
 * @returns درجة من 0 إلى 1 (1 = تطابق كامل)
 */
export function similarityScore(a: string, b: string): number {
  const na = isArabic(a) ? normalizeArabic(a) : normalizeEnglish(a);
  const nb = isArabic(b) ? normalizeArabic(b) : normalizeEnglish(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshteinDistance(na, nb) / maxLen;
}

// ─── 4. مطابقة أفضل موقع في قائمة ────────────────────────────

export interface NamedLocation {
  id: string;
  nameAr: string;
  nameEn?: string;
  aliases?: string[];
}

/**
 * يبحث عن أقرب موقع مطابق في قائمة (للحي أو المحافظة)
 */
export function findBestMatch(
  query: string,
  pool: NamedLocation[],
  minScore = 0.65
): { location: NamedLocation; score: number } | null {
  if (!query.trim()) return null;
  let best: { location: NamedLocation; score: number } | null = null;
  for (const loc of pool) {
    const candidates = [loc.nameAr, loc.nameEn ?? "", ...(loc.aliases ?? [])].filter(Boolean);
    const score = Math.max(...candidates.map((c) => similarityScore(query, c)));
    if (score >= minScore && (!best || score > best.score)) {
      best = { location: loc, score };
    }
  }
  return best;
}

// ─── 5. مقارنة العنوان اليدوي مع Reverse Geocoding ───────────

export interface AddressMatchResult {
  isMatch: boolean;
  score: number;
  /** مفتاح i18n للرسالة المناسبة */
  warningKey: "ok" | "partial_match" | "mismatch";
}

/**
 * يقارن اسم الشارع المدخل يدوياً مع ناتج reverse geocoding
 * لضمان الربط الكامل بين النص والإحداثيات
 */
export function compareAddressWithGeocoding(
  manualText: string,
  geocodedText: string,
  threshold = 0.55
): AddressMatchResult {
  if (!manualText.trim()) return { isMatch: true, score: 1, warningKey: "ok" };
  if (!geocodedText.trim()) return { isMatch: false, score: 0, warningKey: "mismatch" };
  const score = similarityScore(manualText, geocodedText);
  if (score >= 0.75) return { isMatch: true, score, warningKey: "ok" };
  if (score >= threshold) return { isMatch: true, score, warningKey: "partial_match" };
  return { isMatch: false, score, warningKey: "mismatch" };
}

// ─── 6. استخراج الشارع من display_name لـ Nominatim ─────────

/**
 * يستخرج أول حقل (اسم الشارع) من الناتج الكامل لـ Nominatim
 * "شارع سيدي بشر، الإسكندرية، مصر" → "شارع سيدي بشر"
 */
export function extractStreetFromDisplayName(displayName: string): string {
  const street = displayName.split(/[،,]/)[0]?.trim() ?? displayName;
  return street.replace(/^\d+[,،]?\s*/, "").trim();

  // ─── التوافق مع الكود القديم (backward compatibility) ─────────
// يحافظ على أي import قديم لـ geoMatcher بدون تعديل الملفات الأخرى

export { normalizeArabic as cleanArabicText } from "./arabicNormalizer";
export { findBestMatch as matchAreaName    } from "./arabicNormalizer";
export { similarityScore as calcSimilarity } from "./arabicNormalizer";

}
