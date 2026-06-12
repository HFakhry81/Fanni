import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform, ImageBackground, Image, Alert, ActivityIndicator,
  BackHandler, AppState, Modal, Animated,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { pickPhotoWithSourceChooser } from "@/utils/pickPhoto";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams, useFocusEffect, useNavigation } from "expo-router";
import { usePreventRemove } from "@react-navigation/core";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import LocationPicker from "@/components/LocationPicker";
import AppHeader from "@/components/AppHeader";
import ImageLightbox from "@/components/ImageLightbox";
import Toast from "@/components/Toast";
import type { LocationOption } from "@/components/LocationPicker";
import { uploadPhotoToServer } from "@/utils/uploadPhoto";
import type { OrderPhoto } from "@/context/OrderContext";
import * as FileSystem from "expo-file-system";
import SUB_IMAGE_MAP from "@/constants/subImageMap";

// ── API helpers (mirror of LocationPicker) ────────────────────────────────────
function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `http://${domain}` : "";
}

function timeStringToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(isNaN(h) ? 8 : h, isNaN(m) ? 0 : m, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function draftAge(savedAt: unknown, isRTL: boolean): string {
  if (typeof savedAt !== "number") return "";
  const diffMs = Date.now() - savedAt;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);

  if (isRTL) {
    if (diffSec < 60)  return "· تم الحفظ للتو";
    if (diffMin < 60)  return `· محفوظة منذ ${diffMin} ${diffMin === 1 ? "دقيقة" : "دقائق"}`;
    if (diffHr  < 24)  return `· محفوظة منذ ${diffHr} ${diffHr  === 1 ? "ساعة" : "ساعات"}`;
    if (diffDay === 1) return "· محفوظة بالأمس";
    return `· محفوظة منذ ${diffDay} يوم`;
  } else {
    if (diffSec < 60)  return "· Saved just now";
    if (diffMin < 60)  return `· Saved ${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
    if (diffHr  < 24)  return `· Saved ${diffHr} ${diffHr  === 1 ? "hour" : "hours"} ago`;
    if (diffDay === 1) return "· Saved yesterday";
    return `· Saved ${diffDay} days ago`;
  }
}

interface LocationRow { id: string; nameAr: string; nameEn: string; }

async function apiFetchGovernorates(): Promise<LocationRow[]> {
  const base = getApiBase();
  if (!base) return [];
  try {
    const res = await fetch(`${base}/api/locations/governorates`);
    const json = await res.json();
    return json.governorates ?? [];
  } catch { return []; }
}

async function apiFetchAreas(govId: string): Promise<LocationRow[]> {
  const base = getApiBase();
  if (!base || !govId) return [];
  try {
    const res = await fetch(`${base}/api/locations/${govId}/areas`);
    const json = await res.json();
    return json.areas ?? [];
  } catch { return []; }
}

type OrderStep = 1 | 2 | 3;

const DRAFT_KEY = "fanni_order_draft";
const BANNER_HINT_KEY_PREFIX = "fanni_banner_hint_seen:";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function NewOrderScreen() {
  const { category = "", subCategory = "", subImageKey = "" } = useLocalSearchParams<{ category: string; subCategory: string; subImageKey: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { addOrder } = useOrders();
  const { sessionToken, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<OrderStep>(1);
  const [loading, setLoading] = useState(false);

  // ── Order photos ─────────────────────────────────────────────────────────────
  const [orderPhotos, setOrderPhotos] = useState<OrderPhoto[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  const [problemDesc, setProblemDesc] = useState("");
  const [deviceType, setDeviceType] = useState("");

  // ── Step 2 – Location ───────────────────────────────────────────────────────
  const [governorateId, setGovernorateId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [govOpt, setGovOpt] = useState<LocationOption | null>(null);
  const [areaOpt, setAreaOpt] = useState<LocationOption | null>(null);
  const [locationError, setLocationError] = useState<{ governorate?: string; area?: string }>({});
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [landmark, setLandmark] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [visitTimePicker, setVisitTimePicker] = useState(false);

  const navigation = useNavigation();

  const draftRestoredRef      = useRef(false);
  const submittedRef          = useRef(false);
  const loginDraftSavedRef    = useRef(false);
  const hasCheckedBannerRef   = useRef(false);
  const discardOnLeaveRef     = useRef(false);

  // Always-current snapshot of form fields AND route params for unmount/background auto-save
  const fieldsRef = useRef({
    step,
    problemDesc, deviceType,
    governorateId, areaId, govOpt, areaOpt,
    street, building, floor, apartment, landmark,
    latitude, longitude, visitDate, visitTime,
    orderPhotos,
  });
  const routeParamsRef = useRef({ category, subCategory });

  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [, setDraftTick] = useState(0);

  useEffect(() => {
    if (!showDraftBanner) return;
    const id = setInterval(() => setDraftTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [showDraftBanner]);

  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxOpened, setLightboxOpened] = useState(false);

  useEffect(() => {
    if (!subCategory) return;
    AsyncStorage.getItem(BANNER_HINT_KEY_PREFIX + subCategory)
      .then((val) => setLightboxOpened(val === "1"))
      .catch(() => setLightboxOpened(false));
  }, [subCategory]);

  const bannerPulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (lightboxOpened) {
      bannerPulseAnim.stopAnimation();
      bannerPulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(bannerPulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(bannerPulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [lightboxOpened, bannerPulseAnim]);

  const [photoLightboxVisible, setPhotoLightboxVisible] = useState(false);
  const [photoLightboxIndex, setPhotoLightboxIndex] = useState(0);
  const [pendingDraft, setPendingDraft] = useState<Record<string, unknown> | null>(null);
  const [photosMissingToast, setPhotosMissingToast] = useState<{ visible: boolean; key: number }>({ visible: false, key: 0 });

  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const stepLabels = [t("order.describe"), t("order.schedule"), t("order.confirm")];

  // ── Draft restore: when auth finishes loading and user is authenticated ──────
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    if (draftRestoredRef.current) return;
    if (!category && !subCategory) return; // wait for route params to settle

    (async () => {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      let draft: Record<string, unknown>;
      try {
        draft = JSON.parse(raw);
      } catch (err) {
        console.warn("[Fanni] Failed to parse order draft:", err);
        await AsyncStorage.removeItem(DRAFT_KEY);
        return;
      }
      // Discard expired drafts
      if (typeof draft.savedAt === "number" && Date.now() - draft.savedAt > DRAFT_TTL_MS) {
        console.log("[Fanni] Order draft expired — discarding");
        await AsyncStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (draft.category !== category || draft.subCategory !== subCategory) {
        return; // leave draft untouched — it belongs to a different order flow
      }
      // Only auto-restore drafts explicitly saved by the login flow;
      // navigation-away drafts are handled by the banner prompt.
      if (!draft.loginFlow) return;
      draftRestoredRef.current = true;
      if (draft.problemDesc)    setProblemDesc(draft.problemDesc as string);
      if (draft.deviceType)     setDeviceType(draft.deviceType as string);
      if (draft.governorateId)  setGovernorateId(draft.governorateId as string);
      if (draft.areaId)         setAreaId(draft.areaId as string);
      if (draft.govOpt)         setGovOpt(draft.govOpt as LocationOption);
      if (draft.areaOpt)        setAreaOpt(draft.areaOpt as LocationOption);
      if (draft.street)         setStreet(draft.street as string);
      if (draft.building)       setBuilding(draft.building as string);
      if (draft.floor)          setFloor(draft.floor as string);
      if (draft.apartment)      setApartment(draft.apartment as string);
      if (draft.landmark)       setLandmark(draft.landmark as string);
      if (draft.latitude  != null) setLatitude(draft.latitude as number);
      if (draft.longitude != null) setLongitude(draft.longitude as number);
      if (draft.visitDate)      setVisitDate(draft.visitDate as string);
      if (draft.visitTime)      setVisitTime(draft.visitTime as string);
      const { photos: restoredPhotos, hadMissing } = await restorePhotosFromDraft(draft.photoUris);
      setOrderPhotos(restoredPhotos);
      if (hadMissing) {
        setPhotosMissingToast((prev) => ({ visible: true, key: prev.key + 1 }));
      }
      setStep(3);
      await AsyncStorage.removeItem(DRAFT_KEY);
      // Re-enable autosave now that the login-handoff draft has been consumed.
      // Without this reset, persistDraftIfNeeded would always bail out early
      // for the rest of the session, leaving the user unprotected if they
      // background the app or navigate away before submitting.
      loginDraftSavedRef.current = false;
    })();
  }, [authLoading, isAuthenticated, category, subCategory]);

  // ── Fallback: resolve govOpt / areaOpt from API if IDs exist but labels are missing ──
  // Handles older drafts that were saved before govOpt/areaOpt were tracked in state.
  useEffect(() => {
    if (!governorateId) return;
    if (govOpt && areaOpt) return;       // both already resolved — nothing to do
    if (govOpt && !areaId) return;       // gov resolved, no area selected — nothing to do

    (async () => {
      let resolvedGovOpt = govOpt;

      if (!govOpt) {
        const rows = await apiFetchGovernorates();
        const match = rows.find((r) => r.id === governorateId);
        if (match) {
          resolvedGovOpt = { id: match.id, ar: match.nameAr, en: match.nameEn };
          setGovOpt(resolvedGovOpt);
        }
      }

      if (areaId && !areaOpt) {
        const rows = await apiFetchAreas(governorateId);
        const match = rows.find((r) => r.id === areaId);
        if (match) {
          setAreaOpt({ id: match.id, ar: match.nameAr, en: match.nameEn });
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorateId, areaId]);

  // ── Keep fieldsRef and routeParamsRef in sync so the unmount/background cleanup always has fresh values ──
  useEffect(() => {
    fieldsRef.current = {
      step,
      problemDesc, deviceType,
      governorateId, areaId, govOpt, areaOpt,
      street, building, floor, apartment, landmark,
      latitude, longitude, visitDate, visitTime,
      orderPhotos,
    };
    routeParamsRef.current = { category, subCategory };
  });

  // ── On mount: check for a previously auto-saved (non-login) draft ─────────────
  // Depends on category/subCategory so it re-runs if params settle after the first
  // render, but hasCheckedBannerRef ensures it only acts once.
  useEffect(() => {
    if (!category && !subCategory) return;          // params not yet settled
    if (hasCheckedBannerRef.current) return;        // already ran once
    hasCheckedBannerRef.current = true;
    (async () => {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      let draft: Record<string, unknown>;
      try { draft = JSON.parse(raw); } catch { return; }
      // Login-flow drafts are handled by the authenticated restore above
      if (draft.loginFlow) return;
      if (draft.category !== category || draft.subCategory !== subCategory) return;
      if (typeof draft.savedAt === "number" && Date.now() - draft.savedAt > DRAFT_TTL_MS) {
        await AsyncStorage.removeItem(DRAFT_KEY);
        return;
      }
      setPendingDraft(draft);
      setShowDraftBanner(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, subCategory]);

  // ── Shared helper: build and persist a draft snapshot ────────────────────────
  // Pass stepOverride to record the *target* step (e.g. on Next/Back transitions
  // where the state update hasn't fired yet).
  const persistDraftIfNeeded = useCallback((stepOverride?: OrderStep) => {
    if (submittedRef.current)       return; // clean submit — no draft needed
    if (loginDraftSavedRef.current) return; // login-flow handoff in progress
    if (discardOnLeaveRef.current)  return; // user explicitly chose to discard
    const f = fieldsRef.current;
    const { category: cat, subCategory: sub } = routeParamsRef.current;
    const hasContent =
      f.problemDesc || f.deviceType ||
      f.governorateId || f.areaId ||
      f.street || f.building || f.floor || f.apartment || f.landmark ||
      f.visitDate || f.visitTime ||
      f.latitude != null || f.longitude != null ||
      f.orderPhotos.length > 0;
    if (!hasContent) return;                        // nothing to save
    const { orderPhotos: _photos, ...fieldData } = f;
    const remotePhotos = f.orderPhotos.filter(
      (p) => !p.uri.startsWith("file://") && !p.uri.startsWith("content://"),
    );
    const draft = {
      ...fieldData,
      step: stepOverride ?? f.step,
      category: cat, subCategory: sub,
      savedAt: Date.now(),
      loginFlow: false,
      photoUris: remotePhotos.map((p) => ({ id: p.id, uri: p.uri, phase: p.phase })),
    };
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => { persistDraftIfNeeded(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save when app is backgrounded (home button, incoming call, etc.) ────
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        persistDraftIfNeeded();
      }
    });
    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Validate draft photo entries: check local URIs still exist on disk ────────
  const restorePhotosFromDraft = async (
    raw: unknown,
  ): Promise<{ photos: OrderPhoto[]; hadMissing: boolean }> => {
    if (!Array.isArray(raw) || raw.length === 0) return { photos: [], hadMissing: false };
    const results: OrderPhoto[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry.uri !== "string") continue;
      const uri: string = entry.uri;
      const id: string = typeof entry.id === "string" ? entry.id : `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const phase = entry.phase === "after" ? "after" as const : "problem" as const;
      if (uri.startsWith("file://") || uri.startsWith("content://")) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists) results.push({ id, uri, phase });
        } catch {
          // silently skip inaccessible URIs
        }
      } else {
        results.push({ id, uri, phase });
      }
    }
    const hadMissing = raw.length > 0 && results.length < raw.length;
    return { photos: results, hadMissing };
  };

  // ── Save draft and trigger login ─────────────────────────────────────────────
  const handleLoginToSubmit = async () => {
    loginDraftSavedRef.current = true;
    const draft = {
      category, subCategory,
      problemDesc, deviceType,
      governorateId, areaId,
      govOpt, areaOpt,
      street, building, floor, apartment, landmark,
      latitude, longitude,
      visitDate, visitTime,
      savedAt: Date.now(),
      loginFlow: true,
      photoUris: orderPhotos
        .filter((p) => !p.uri.startsWith("file://") && !p.uri.startsWith("content://"))
        .map((p) => ({ id: p.id, uri: p.uri, phase: p.phase })),
    };
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    const result = await login();
    // Only discard the draft when the login definitively failed or was abandoned.
    // "opened" means the browser is still open; "success" means auth completed.
    // For any other unexpected result we keep the draft to avoid data loss.
    if (result === "cancel" || result === "dismiss" || result === "error" || result === "locked") {
      await AsyncStorage.removeItem(DRAFT_KEY);
      // Re-enable unmount auto-save so further edits aren't silently dropped.
      loginDraftSavedRef.current = false;
    }
  };

  // ── Draft banner handlers ─────────────────────────────────────────────────────
  const handleRestoreDraft = async () => {
    if (!pendingDraft) return;
    const d = pendingDraft;
    if (d.problemDesc)    setProblemDesc(d.problemDesc as string);
    if (d.deviceType)     setDeviceType(d.deviceType as string);
    if (d.governorateId)  setGovernorateId(d.governorateId as string);
    if (d.areaId)         setAreaId(d.areaId as string);
    if (d.govOpt)         setGovOpt(d.govOpt as LocationOption);
    if (d.areaOpt)        setAreaOpt(d.areaOpt as LocationOption);
    if (d.street)         setStreet(d.street as string);
    if (d.building)       setBuilding(d.building as string);
    if (d.floor)          setFloor(d.floor as string);
    if (d.apartment)      setApartment(d.apartment as string);
    if (d.landmark)       setLandmark(d.landmark as string);
    if (d.latitude  != null) setLatitude(d.latitude as number);
    if (d.longitude != null) setLongitude(d.longitude as number);
    if (d.visitDate)      setVisitDate(d.visitDate as string);
    if (d.visitTime)      setVisitTime(d.visitTime as string);
    if (d.step && (d.step === 1 || d.step === 2 || d.step === 3)) setStep(d.step as OrderStep);
    const { photos: restoredPhotos, hadMissing } = await restorePhotosFromDraft(d.photoUris);
    setOrderPhotos(restoredPhotos);
    if (hadMissing) {
      setPhotosMissingToast((prev) => ({ visible: true, key: prev.key + 1 }));
    }
    await AsyncStorage.removeItem(DRAFT_KEY);
    setShowDraftBanner(false);
    setPendingDraft(null);
  };

  const handleDiscardDraft = async () => {
    await AsyncStorage.removeItem(DRAFT_KEY);
    setShowDraftBanner(false);
    setPendingDraft(null);
  };

  // ── Check whether the user has entered anything worth warning about ──────────
  const hasFormData = useCallback((): boolean => {
    return !!(
      problemDesc || deviceType ||
      governorateId || areaId ||
      street || building || floor || apartment || landmark ||
      visitDate || visitTime ||
      latitude != null || longitude != null ||
      orderPhotos.length > 0
    );
  }, [
    problemDesc, deviceType, governorateId, areaId,
    street, building, floor, apartment, landmark,
    visitDate, visitTime, latitude, longitude, orderPhotos,
  ]);

  // ── Shared "Leave form?" confirmation dialog ─────────────────────────────────
  // Any exit path — back arrow, X/close button, iOS swipe-to-dismiss, Android
  // hardware back, or programmatic router.back() — must go through this one
  // function so users always see the same prompt before unsaved data is lost.
  // `onConfirm` is called only when the user explicitly chooses "Leave".
  const confirmDiscardIfDirty = useCallback(
    (onConfirm: () => void) => {
      if (!hasFormData() || submittedRef.current || discardOnLeaveRef.current) {
        onConfirm();
        return;
      }
      Alert.alert(
        isRTL ? "مغادرة النموذج؟" : "Leave form?",
        isRTL
          ? "لديك بيانات غير محفوظة. هل تريد المغادرة وفقدانها؟"
          : "You have unsaved data. Leave and discard your changes?",
        [
          { text: isRTL ? "تابع التعبئة" : "Keep editing", style: "cancel" },
          {
            text: isRTL ? "مغادرة" : "Leave",
            style: "destructive",
            onPress: () => {
              discardOnLeaveRef.current = true;
              onConfirm();
            },
          },
        ]
      );
    },
    [hasFormData, isRTL]
  );

  // ── Block removal and show "Leave form?" for every exit path ─────────────────
  // usePreventRemove is the React Navigation 7 canonical hook for this use case.
  // It integrates at the native layer and fires for ALL removal triggers:
  //   • iOS swipe-back gesture on a stack screen
  //   • iOS swipe-to-dismiss on a native-stack modal / formSheet
  //   • AppHeader back arrow  → router.back()
  //   • Any close/X button   → router.back()
  //   • Android hardware back (when on step 1, falls through to here)
  //   • Programmatic navigation.goBack() / router.replace()
  //
  // preventRemove is kept permanently true so the callback always runs.
  // Inside the callback we mirror the same inline checks as the old beforeRemove
  // listener (submitted / discardOnLeaveRef / hasFormData) so that:
  //   - Clean forms, submitted orders, and confirmed-leave paths are allowed through
  //     immediately by re-dispatching `data.action` without a dialog.
  //   - Dirty forms show the shared confirmDiscardIfDirty dialog; on "Leave" the
  //     original action is re-dispatched (React Navigation's re-dispatch mechanism
  //     bypasses the hook for that specific action, so no infinite loop).
  //
  // discardOnLeaveRef stays true through unmount so the auto-save cleanup skips
  // saving after a confirmed "Leave".
  usePreventRemove(true, ({ data }) => {
    if (!hasFormData() || submittedRef.current || discardOnLeaveRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    confirmDiscardIfDirty(() => navigation.dispatch(data.action));
  });

  // ── Intercept Android hardware back between steps (step 2→1 stays in form) ───
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (step > 1) {
          const prevStep = (step - 1) as OrderStep;
          persistDraftIfNeeded(prevStep);
          setStep(prevStep);
          return true; // handled — move to previous step, no dialog
        }
        return false; // let Expo Router handle it → triggers usePreventRemove callback
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
      return () => sub.remove();
    }, [step, persistDraftIfNeeded])
  );

  const validateLocation = (): { governorate?: string; area?: string } => {
    const errors: { governorate?: string; area?: string } = {};
    if (!governorateId || !govOpt) {
      errors.governorate = isRTL
        ? "المحافظة غير معروفة — الرجاء الاختيار من القائمة"
        : "Governorate could not be matched — please select from the list";
    }
    if (!areaId || !areaOpt) {
      errors.area = isRTL
        ? "المنطقة غير معروفة — الرجاء الاختيار من القائمة"
        : "Area could not be matched — please select from the list";
    }
    return errors;
  };

  const handleNext = () => {
    if (step === 2) {
      const errors = validateLocation();
      if (errors.governorate || errors.area) {
        setLocationError(errors);
        return;
      }
      setLocationError({});
    }
    if (step < 3) {
      const nextStep = (step + 1) as OrderStep;
      persistDraftIfNeeded(nextStep);
      setStep(nextStep);
    }
  };
  const handleBack = () => {
    if (step > 1) {
      const prevStep = (step - 1) as OrderStep;
      persistDraftIfNeeded(prevStep);
      setStep(prevStep);
    } else {
      router.back(); // beforeRemove listener will prompt if form has data
    }
  };

  const isLocalUri = (uri: string) => uri.startsWith("file://") || uri.startsWith("content://");

  const handleSubmit = async () => {
    const locationErrors = validateLocation();
    if (locationErrors.governorate || locationErrors.area) {
      setLocationError(locationErrors);
      setStep(2);
      return;
    }

    setLoading(true);

    let resolvedPhotos = orderPhotos;
    if (orderPhotos.some((p) => isLocalUri(p.uri))) {
      if (!sessionToken) {
        Alert.alert(
          isRTL ? "يجب تسجيل الدخول" : "Sign In Required",
          isRTL ? "يرجى تسجيل الدخول لإرسال الطلب مع الصور." : "Please sign in to submit your order with photos."
        );
        setLoading(false);
        return;
      }
      const uploaded: OrderPhoto[] = [];
      for (const photo of orderPhotos) {
        if (isLocalUri(photo.uri)) {
          try {
            const { url } = await uploadPhotoToServer(photo.uri, sessionToken, "image/jpeg");
            uploaded.push({ ...photo, uri: url });
          } catch {
            Alert.alert(
              isRTL ? "فشل الرفع" : "Upload Failed",
              isRTL ? "تعذّر رفع إحدى الصور. يرجى إزالتها والمحاولة مرة أخرى." : "Could not upload a photo. Please remove it and try again."
            );
            setLoading(false);
            return;
          }
        } else {
          uploaded.push(photo);
        }
      }
      resolvedPhotos = uploaded;
    }

    await new Promise((r) => setTimeout(r, 1200));
    const orderId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;

    const fullAddress = [
      govOpt  ? (isRTL ? govOpt.ar  : govOpt.en)  : "",
      areaOpt ? (isRTL ? areaOpt.ar : areaOpt.en) : "",
      street,
    ].filter(Boolean).join(isRTL ? "، " : ", ");

    const newOrder = {
      id: orderId,
      orderNumber,
      clientId: user?.id ?? "client1",
      clientName: user?.name ?? "",
      clientMobile: user?.mobile ?? "",
      category: category as string,
      subCategory: subCategory as string,
      subImageKey: subImageKey || undefined,
      problemDescription: problemDesc,
      deviceType,
      photos: resolvedPhotos,
      street: fullAddress,
      building, floor, apartment, landmark,
      governorate: govOpt ? govOpt.en.toLowerCase() : undefined,
      area: areaOpt ? areaOpt.en.toLowerCase() : undefined,
      latitude:  latitude  ?? undefined,
      longitude: longitude ?? undefined,
      visitDate, visitTime,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };

    await addOrder(newOrder);

    const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
    if (domain) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (sessionToken) {
          headers["Authorization"] = `Bearer ${sessionToken}`;
        }
        const res = await fetch(`http://${domain}/api/orders`, {
          method: "POST",
          headers,
          body: JSON.stringify(newOrder),
        });
        if (!res.ok) {
          console.warn("[Fanni] Failed to broadcast order to server:", res.status);
        }
      } catch (err) {
        console.warn("[Fanni] Could not reach order notification server:", err);
      }
    }

    await AsyncStorage.removeItem(DRAFT_KEY);
    submittedRef.current = true;
    setLoading(false);
    router.replace("/(client)/orders");
  };

  // ── Order photo picking ───────────────────────────────────────────────────────
  const MAX_PHOTOS = 5;

  const pickOrderPhoto = async () => {
    if (orderPhotos.length >= MAX_PHOTOS) {
      Alert.alert(
        isRTL ? "الحد الأقصى" : "Maximum Reached",
        isRTL ? `يمكنك إضافة ${MAX_PHOTOS} صور كحد أقصى.` : `You can add up to ${MAX_PHOTOS} photos.`
      );
      return;
    }
    const asset = await pickPhotoWithSourceChooser(isRTL);
    if (!asset) return;
    const photoId = `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    if (!sessionToken) {
      setOrderPhotos((prev) => [...prev, { id: photoId, uri: asset.uri, phase: "problem" as const }]);
      return;
    }
    setPhotoUploading(true);
    try {
      const { url } = await uploadPhotoToServer(asset.uri, sessionToken, asset.mimeType);
      setOrderPhotos((prev) => [...prev, { id: photoId, uri: url, phase: "problem" as const }]);
    } catch (_) {
      Alert.alert(
        isRTL ? "فشل الرفع" : "Upload Failed",
        isRTL ? "تعذّر رفع الصورة، يرجى المحاولة مرة أخرى." : "Could not upload photo, please try again."
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const removeOrderPhoto = (id: string) => {
    setOrderPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // ── Step 1: Describe ────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <View>
      <View style={[styles.categoryBadge, { backgroundColor: colors.accent, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <VectorIcon name="tag" size={14} color={colors.primary} />
        <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
          {t(`cat.${category}`)} — {subCategory}
        </Text>
      </View>

      <FanniInput
        label={t("order.problemDesc")}
        value={problemDesc} onChangeText={setProblemDesc}
        multiline numberOfLines={4}
        placeholder={isRTL ? "اشرح المشكلة بالتفصيل..." : "Describe the problem in detail..."}
        required
      />
      <FanniInput
        label={t("order.deviceType")}
        value={deviceType} onChangeText={setDeviceType}
        placeholder={isRTL ? "مثال: مكيف سبليت 1.5 حصان" : "e.g. Split AC 1.5HP"}
      />

      <Text style={[styles.uploadLabel, { color: colors.foreground, fontFamily: "Inter_500Medium", textAlign: isRTL ? "right" : "left" }]}>
        {t("order.photos")}
      </Text>
      <View style={[styles.photosRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {orderPhotos.map((photo) => (
          <TouchableOpacity
            key={photo.id}
            style={[styles.photoBox, { borderColor: colors.primary, borderRadius: colors.radius, overflow: "hidden", borderStyle: "solid" }]}
            onPress={() => {
              setPhotoLightboxIndex(orderPhotos.indexOf(photo));
              setPhotoLightboxVisible(true);
            }}
            onLongPress={() => {
              Alert.alert(
                isRTL ? "حذف الصورة" : "Remove Photo",
                isRTL ? "هل تريد حذف هذه الصورة؟" : "Remove this photo?",
                [
                  { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
                  { text: isRTL ? "حذف" : "Remove", style: "destructive", onPress: () => removeOrderPhoto(photo.id) },
                ]
              );
            }}
          >
            <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            <View style={{ position: "absolute", bottom: 3, right: 3, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 6, padding: 3 }}>
              <VectorIcon name="maximize-2" size={10} color="#FFF" />
            </View>
          </TouchableOpacity>
        ))}
        {orderPhotos.length < MAX_PHOTOS && (
          <TouchableOpacity
            style={[styles.photoBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted }]}
            onPress={pickOrderPhoto}
            disabled={photoUploading}
          >
            {photoUploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <VectorIcon name="plus" size={22} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ── Step 2: Address / Schedule ──────────────────────────────────────────────
  const renderStep2 = () => (
    <View>
      {/* Egypt badge */}
      <View style={[styles.egyptBadge, { backgroundColor: colors.accent, borderColor: colors.primary, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text style={{ fontSize: 18 }}>🇪🇬</Text>
        <View style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0, flex: 1 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>
            {isRTL ? "عنوان الزيارة" : "Visit Address"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
            {isRTL ? "الإسكندرية ومحافظات مصر" : "Alexandria & all Egypt governorates"}
          </Text>
        </View>
      </View>

      <LocationPicker
        governorateId={governorateId}
        areaId={areaId}
        onGovernorateChange={(id) => { setGovernorateId(id); if (!id) { setGovOpt(null); setAreaOpt(null); } }}
        onAreaChange={(id) => { setAreaId(id); if (!id) setAreaOpt(null); }}
        onGovernorateSelect={(opt) => {
          setGovOpt(opt);
          setAreaOpt(null);
          setLocationError((prev) => ({ ...prev, governorate: undefined }));
        }}
        onAreaSelect={(opt) => {
          setAreaOpt(opt);
          setLocationError((prev) => ({ ...prev, area: undefined }));
        }}
        governorateError={locationError.governorate}
        areaError={locationError.area}
        street={street}
        onStreetChange={setStreet}
        building={building}
        onBuildingChange={setBuilding}
        floor={floor}
        onFloorChange={setFloor}
        apartment={apartment}
        onApartmentChange={setApartment}
        showDetails
        latitude={latitude}
        longitude={longitude}
        onCoordsChange={(lat, lon) => { setLatitude(lat); setLongitude(lon); }}
      />

      <FanniInput
        label={isRTL ? "علامة مميزة" : "Landmark"}
        value={landmark} onChangeText={setLandmark}
        placeholder={isRTL ? "مثال: بجانب مسجد..." : "e.g. Near the mosque..."}
      />

      {/* Schedule */}
      <View style={[styles.scheduleHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.scheduleIcon, { backgroundColor: colors.accentBlue }]}>
          <VectorIcon name="calendar" size={16} color={colors.secondary} />
        </View>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
          {isRTL ? "موعد الزيارة" : "Visit Schedule"}
        </Text>
      </View>

      <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <FanniInput
          label={t("order.visitDate")} value={visitDate} onChangeText={setVisitDate}
          placeholder="2025-01-25"
          style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6, textAlign: isRTL ? "right" : "left" }}>
            {t("order.visitTime")}
          </Text>
          <TouchableOpacity
            onPress={() => setVisitTimePicker(true)}
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ color: visitTime ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>
              {visitTime || (isRTL ? "اختر الوقت" : "Pick time")}
            </Text>
            <VectorIcon name="clock" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Android time picker */}
      {Platform.OS === "android" && visitTimePicker && (
        <DateTimePicker
          mode="time"
          is24Hour
          value={timeStringToDate(visitTime || "10:00")}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setVisitTimePicker(false);
            if (event.type === "set" && date) {
              setVisitTime(dateToTimeString(date));
            }
          }}
        />
      )}

      {/* iOS: modal with spinner picker + Done button */}
      {Platform.OS === "ios" && visitTimePicker && (
        <Modal transparent animationType="slide">
          <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} activeOpacity={1} onPress={() => setVisitTimePicker(false)} />
          <View style={{ backgroundColor: colors.card, paddingBottom: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 12 }}>
              <TouchableOpacity onPress={() => setVisitTimePicker(false)}>
                <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>{isRTL ? "تم" : "Done"}</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              mode="time"
              is24Hour
              display="spinner"
              value={timeStringToDate(visitTime || "10:00")}
              onChange={(_event: DateTimePickerEvent, date?: Date) => {
                if (date) setVisitTime(dateToTimeString(date));
              }}
              style={{ width: "100%" }}
            />
          </View>
        </Modal>
      )}
    </View>
  );

  // ── Step 3: Confirm ─────────────────────────────────────────────────────────
  const renderStep3 = () => {
    const rows = [
      { label: isRTL ? "نوع الخدمة" : "Service",     value: `${t(`cat.${category}`)} — ${subCategory}` },
      { label: t("order.problemDesc"),                 value: problemDesc || "—" },
      { label: t("order.deviceType"),                  value: deviceType || "—" },
      { label: isRTL ? "المحافظة" : "Governorate",    value: govOpt  ? (isRTL ? govOpt.ar  : govOpt.en)  : "—" },
      { label: isRTL ? "المنطقة" : "Area",            value: areaOpt ? (isRTL ? areaOpt.ar : areaOpt.en) : "—" },
      { label: isRTL ? "الشارع" : "Street",           value: street || "—" },
      { label: t("order.visitDate"),                   value: visitDate || "—" },
      { label: t("order.visitTime"),                   value: visitTime || "—" },
    ];

    return (
      <View>
        <View style={[styles.confirmHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.confirmIcon, { backgroundColor: colors.accent }]}>
            <VectorIcon name="check-circle" size={22} color={colors.primary} />
          </View>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
            {t("order.confirm")}
          </Text>
        </View>

        {rows.map((item) => (
          <View
            key={item.label}
            style={[styles.confirmRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
          >
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 }}>
              {item.label}
            </Text>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 2, textAlign: isRTL ? "left" : "right" }}>
              {item.value}
            </Text>
          </View>
        ))}

        <View style={[styles.totalRow, { backgroundColor: colors.accent, borderColor: colors.primary, borderRadius: colors.radius }]}>
          <VectorIcon name="dollar-sign" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15, marginLeft: 8 }}>
            {isRTL ? "سيتم تحديد السعر بعد الكشف" : "Price will be set after inspection"}
          </Text>
        </View>

        {!isAuthenticated && (
          <View style={[styles.loginNotice, { backgroundColor: colors.accentBlue, borderRadius: colors.radius }]}>
            <VectorIcon name="lock" size={16} color={colors.secondary} />
            <Text style={{ color: colors.secondary, fontFamily: "Inter_500Medium", fontSize: 13, marginLeft: 8, flex: 1 }}>
              {isRTL
                ? "سجّل دخولك لتأكيد الطلب — بياناتك محفوظة"
                : "Sign in to confirm — your details are saved"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={t("order.new")} showBack onBack={() => router.back()} />
        <View style={styles.authGate}>
          <VectorIcon name="loader" size={32} color={colors.primary} />
        </View>
      </View>
    );
  }

  const bannerImage = subImageKey ? SUB_IMAGE_MAP[subImageKey] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("order.new")} showBack onBack={handleBack} />

      {/* Service preview banner */}
      {bannerImage && (
        <>
          <TouchableOpacity activeOpacity={0.9} onPress={() => { setLightboxVisible(true); if (!lightboxOpened) { setLightboxOpened(true); AsyncStorage.setItem(BANNER_HINT_KEY_PREFIX + subCategory, "1"); } }}>
            <ImageBackground
              source={bannerImage}
              style={styles.banner}
              resizeMode="cover"
            >
              <LinearGradient
                colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.62)"]}
                style={styles.bannerGradient}
              >
                <Text style={styles.bannerLabel} numberOfLines={2}>
                  {subCategory}
                </Text>
              </LinearGradient>
              {!lightboxOpened && (
                <Animated.View style={[styles.bannerHint, { transform: [{ scale: bannerPulseAnim }] }]}>
                  <VectorIcon name="maximize-2" size={14} color="#FFFFFF" />
                </Animated.View>
              )}
            </ImageBackground>
          </TouchableOpacity>
          <ImageLightbox
            visible={lightboxVisible}
            sources={[bannerImage]}
            onClose={() => setLightboxVisible(false)}
          />
        </>
      )}

      {orderPhotos.length > 0 && (
        <ImageLightbox
          visible={photoLightboxVisible}
          sources={orderPhotos.map((p) => ({ uri: p.uri }))}
          initialIndex={photoLightboxIndex}
          onClose={() => setPhotoLightboxVisible(false)}
        />
      )}

      {/* Step indicator */}
      <View style={[styles.stepsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {stepLabels.map((label, idx) => (
          <View key={idx} style={[styles.stepItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.stepDot, { backgroundColor: idx + 1 <= step ? colors.primary : colors.border }]}>
              {idx + 1 < step
                ? <VectorIcon name="check" size={12} color="#FFF" />
                : <Text style={{ color: idx + 1 <= step ? "#FFF" : colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{idx + 1}</Text>
              }
            </View>
            <Text
              style={{ color: idx + 1 <= step ? colors.primary : colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: isRTL ? 0 : 4, marginRight: isRTL ? 4 : 0 }}
              numberOfLines={1}
            >
              {label}
            </Text>
            {idx < stepLabels.length - 1 && (
              <View style={[styles.stepConnector, { backgroundColor: idx + 1 < step ? colors.primary : colors.border }]} />
            )}
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {showDraftBanner && (
          <View style={[styles.draftBanner, { backgroundColor: colors.accentBlue, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={{ marginTop: 2 }}><VectorIcon name="clock" size={18} color={colors.secondary} /></View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {isRTL ? "لديك مسودة محفوظة" : "You have a saved draft"}
                {"  "}
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, opacity: 0.75 }}>
                  {draftAge(pendingDraft?.savedAt, isRTL)}
                </Text>
              </Text>
              <Text style={{ color: colors.secondary, fontFamily: "Inter_400Regular", fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                {isRTL ? "هل تريد المتابعة من حيث توقفت؟" : "Continue where you left off?"}
              </Text>
              <View style={[styles.draftBannerActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <TouchableOpacity
                  onPress={handleRestoreDraft}
                  style={[styles.draftBtn, { backgroundColor: colors.secondary }]}
                >
                  <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                    {isRTL ? "متابعة" : "Continue"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDiscardDraft} style={styles.draftBtnOutline}>
                  <Text style={{ color: colors.secondary, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                    {isRTL ? "بدء جديد" : "Start fresh"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </View>

        <View style={[styles.navBtns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {step > 1 && (
            <FanniButton
              title={t("common.back")} onPress={handleBack}
              variant="outline"
              style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
            />
          )}
          {step < 3
            ? <FanniButton title={t("common.next")} onPress={handleNext} style={{ flex: 1 }} />
            : isAuthenticated
              ? <FanniButton title={t("common.sendOrder")} onPress={handleSubmit} loading={loading} style={{ flex: 1 }} />
              : <FanniButton
                  title={isRTL ? "تسجيل الدخول للإرسال" : "Log In to Submit"}
                  onPress={handleLoginToSubmit}
                  style={{ flex: 1 }}
                />
          }
        </View>
      </ScrollView>

      <Toast
        key={`photos-missing-${photosMissingToast.key}`}
        visible={photosMissingToast.visible}
        message={
          isRTL
            ? "بعض صور المسودة لم تعد متاحة وتم حذفها"
            : "Some photos from your draft were no longer available and have been removed"
        }
        duration={5000}
        variant="error"
        onPress={() => {}}
        onHide={() => setPhotosMissingToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner:         { width: "100%", height: 160 },
  bannerGradient: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 18, paddingBottom: 14 },
  bannerLabel:    { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 18 },
  bannerHint:     { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 8, padding: 6 },
  stepsRow: { paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "space-between" },
  stepItem: { flex: 1, alignItems: "center" },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepConnector: { flex: 1, height: 2, marginHorizontal: 4 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  card: { padding: 20, shadowColor: "#0D1B2A", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3, marginBottom: 16 },
  categoryBadge: { padding: 10, marginBottom: 16, alignSelf: "flex-start", alignItems: "center" },
  uploadLabel: { fontSize: 14, marginBottom: 10 },
  photosRow: { gap: 10, marginBottom: 12 },
  photoBox: { width: 72, height: 72, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed" },
  row: { gap: 0 },
  egyptBadge: { padding: 12, borderWidth: 1.5, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  scheduleHeader: { alignItems: "center", marginTop: 8, marginBottom: 4 },
  scheduleIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  confirmHeader: { alignItems: "center", marginBottom: 20 },
  confirmIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  confirmRow: { paddingVertical: 10, borderBottomWidth: 1, alignItems: "center", flexDirection: "row" },
  totalRow: { padding: 14, borderWidth: 1.5, marginTop: 16, flexDirection: "row", alignItems: "center" },
  loginNotice: { padding: 12, marginTop: 14, flexDirection: "row", alignItems: "center" },
  navBtns: { gap: 8, marginBottom: 8 },
  authGate: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  draftBanner: { padding: 14, marginBottom: 12, alignItems: "flex-start" },
  draftBannerActions: { marginTop: 10, gap: 8 },
  draftBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  draftBtnOutline: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
});
