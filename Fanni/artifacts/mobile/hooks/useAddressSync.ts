/**
 * useAddressSync.ts
 * Hook مركزي يدير الربط الكامل بين إدخال العنوان والإحداثيات
 *
 * القاعدة الذهبية للتطبيق:
 *   الإحداثيات هي مصدر الحقيقة الوحيد.
 *   الشارع مشتق منها عبر reverse geocoding.
 *   إذا عدّل المستخدم الشارع يدوياً → تظهر تحذير ويطلب منه
 *   تأكيد الدبوس من جديد قبل الحفظ.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import {
  compareAddressWithGeocoding,
  extractStreetFromDisplayName,
} from "../utils/arabicNormalizer";
import { getApiBase } from "../utils/api";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface LocationValue {
  /** معرّف المحافظة (مطابق لـ id في DB) */
  governorateId: string;
  /** الاسم العربي للمحافظة */
  governorateName: string;
  /** معرّف المنطقة/الحي */
  areaId: string;
  /** الاسم العربي للمنطقة */
  areaName: string;
  /** اسم الشارع — مشتق من reverse geocoding أو مدخل يدوياً */
  street: string;
  /** رقم المبنى */
  building: string;
  /** رقم الطابق */
  floor: string;
  /** رقم الشقة */
  apartment: string;
  /** خط العرض — المصدر الحقيقي للموقع */
  latitude: number | null;
  /** خط الطول */
  longitude: number | null;
  /** هل تم تأكيد موضع الدبوس على الخريطة؟ */
  pinConfirmed: boolean;
  /** هل عدّل المستخدم الشارع يدوياً بعد آخر reverse geocoding? */
  streetManuallyEdited: boolean;
  /** نتيجة reverse geocoding الخام — للمقارنة مع ما أدخله المستخدم */
  geocodedStreet: string;
}

export interface AddressSyncState {
  location: LocationValue;
  isGeocoding: boolean;
  geocodeError: string | null;
  /** حالة التطابق بين الشارع اليدوي والإحداثيات */
  addressMatchStatus: "ok" | "partial_match" | "mismatch" | "unchecked";
  /** هل يمكن حفظ النموذج؟ */
  canSubmit: boolean;
}

export type AddressSyncActions = {
  setGovernorate: (id: string, name: string) => void;
  setArea: (id: string, name: string) => void;
  /** يُستدعى عند انتهاء سحب الدبوس أو تحريك الخريطة */
  onPinMoved: (lat: number, lng: number) => void;
  /** يُستدعى عند الضغط على "تأكيد الموقع" */
  confirmPin: () => void;
  /** يُستدعى عند تغيير اسم الشارع يدوياً */
  onStreetManualChange: (text: string) => void;
  setBuilding: (v: string) => void;
  setFloor: (v: string) => void;
  setApartment: (v: string) => void;
  /** إعادة الضبط الكامل */
  reset: () => void;
};

// ─────────────────────────────────────────────────────────────
// Default empty state
// ─────────────────────────────────────────────────────────────

const EMPTY_LOCATION: LocationValue = {
  governorateId: "",
  governorateName: "",
  areaId: "",
  areaName: "",
  street: "",
  building: "",
  floor: "",
  apartment: "",
  latitude: null,
  longitude: null,
  pinConfirmed: false,
  streetManuallyEdited: false,
  geocodedStreet: "",
};

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * @param initialValue - قيمة ابتدائية اختيارية (للتعديل على بيانات موجودة)
 * @param lang - 'ar' | 'en'  لإرسال لغة reverse geocoding الصحيحة
 * @param debounceMs - تأخير reverse geocoding بعد توقف الدبوس (افتراضي 600ms)
 */
export function useAddressSync(
  initialValue: Partial<LocationValue> = {},
  lang: "ar" | "en" = "ar",
  debounceMs = 600
): AddressSyncState & AddressSyncActions {
  const [location, setLocation] = useState<LocationValue>({
    ...EMPTY_LOCATION,
    ...initialValue,
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // Ref للـ debounce timer
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // الإحداثيات المعلّقة (قبل تأكيد المستخدم)
  const pendingCoords = useRef<{ lat: number; lng: number } | null>(null);

  // ─── Reverse Geocoding ──────────────────────────────────────

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      setIsGeocoding(true);
      setGeocodeError(null);
      try {
        const base = getApiBase();
        const url = `${base}/api/geo/reverse?lat=${lat}&lon=${lng}&lang=${lang}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const rawDisplayName: string =
          data?.display_name ?? data?.address?.road ?? "";
        const street = extractStreetFromDisplayName(rawDisplayName);

        setLocation((prev) => ({
          ...prev,
          geocodedStreet: street,
          // نحدّث الشارع فقط إذا لم يكن المستخدم يكتب يدوياً
          street: prev.streetManuallyEdited ? prev.street : street,
          streetManuallyEdited: false,
        }));
      } catch (e) {
        setGeocodeError("geocode_failed");
      } finally {
        setIsGeocoding(false);
      }
    },
    [lang]
  );

  // ─── تحريك الدبوس (debounced) ──────────────────────────────

  const onPinMoved = useCallback(
    (lat: number, lng: number) => {
      pendingCoords.current = { lat, lng };

      // تحديث الإحداثيات فوراً لعرض الموقع على الخريطة
      setLocation((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        // إلغاء تأكيد الدبوس القديم — يجب تأكيد الجديد
        pinConfirmed: false,
        streetManuallyEdited: false,
      }));

      // إلغاء الـ timer السابق
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);

      // reverse geocoding بعد توقف المستخدم عن الحركة
      geocodeTimer.current = setTimeout(() => {
        reverseGeocode(lat, lng);
      }, debounceMs);
    },
    [reverseGeocode, debounceMs]
  );

  // ─── تأكيد الدبوس ──────────────────────────────────────────

  const confirmPin = useCallback(() => {
    setLocation((prev) => ({
      ...prev,
      pinConfirmed: true,
      streetManuallyEdited: false, // عند تأكيد الدبوس تُعاد القيمة الاتوماتيكية
    }));
  }, []);

  // ─── تغيير الشارع يدوياً ───────────────────────────────────

  const onStreetManualChange = useCallback((text: string) => {
    setLocation((prev) => ({
      ...prev,
      street: text,
      // نحدّد أن المستخدم عدّل يدوياً فقط إذا اختلف عن Reverse Geocoding
      streetManuallyEdited: text !== prev.geocodedStreet,
      // تعديل الشارع يدوياً يلغي تأكيد الدبوس
      pinConfirmed: text === prev.geocodedStreet ? prev.pinConfirmed : false,
    }));
  }, []);

  // ─── Setters البسيطة ────────────────────────────────────────

  const setGovernorate = useCallback((id: string, name: string) => {
    setLocation((prev) => ({
      ...prev,
      governorateId: id,
      governorateName: name,
      // تغيير المحافظة يعيد ضبط المنطقة والإحداثيات
      areaId: "",
      areaName: "",
      latitude: null,
      longitude: null,
      pinConfirmed: false,
      street: "",
      geocodedStreet: "",
      streetManuallyEdited: false,
    }));
  }, []);

  const setArea = useCallback((id: string, name: string) => {
    setLocation((prev) => ({
      ...prev,
      areaId: id,
      areaName: name,
      // تغيير المنطقة يعيد ضبط الإحداثيات الدقيقة
      pinConfirmed: false,
    }));
  }, []);

  const setBuilding  = useCallback((v: string) => setLocation((p) => ({ ...p, building: v })), []);
  const setFloor     = useCallback((v: string) => setLocation((p) => ({ ...p, floor: v })), []);
  const setApartment = useCallback((v: string) => setLocation((p) => ({ ...p, apartment: v })), []);

  const reset = useCallback(() => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setLocation(EMPTY_LOCATION);
    setIsGeocoding(false);
    setGeocodeError(null);
  }, []);

  // ─── حساب حالة التطابق ─────────────────────────────────────

  const addressMatchStatus = (() => {
    if (!location.pinConfirmed) return "unchecked" as const;
    if (!location.streetManuallyEdited) return "ok" as const;
    const result = compareAddressWithGeocoding(
      location.street,
      location.geocodedStreet
    );
    return result.warningKey;
  })();

  // ─── هل يمكن الإرسال؟ ──────────────────────────────────────

  const canSubmit =
    !!location.governorateId &&
    !!location.areaId &&
    location.latitude !== null &&
    location.longitude !== null &&
    location.pinConfirmed &&
    addressMatchStatus !== "mismatch";

  // ─── تنظيف الـ timer عند unmount ───────────────────────────

  useEffect(() => {
    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, []);

  return {
    // State
    location,
    isGeocoding,
    geocodeError,
    addressMatchStatus,
    canSubmit,
    // Actions
    setGovernorate,
    setArea,
    onPinMoved,
    confirmPin,
    onStreetManualChange,
    setBuilding,
    setFloor,
    setApartment,
    reset,
  };
}
