import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Publisher / product identity for Fanni (owned by UpNexa).
 * Keep package id stable unless Firebase + store listings are migrated together.
 */
export const APP_IDENTITY = {
  productNameEn: "Fanni",
  productNameAr: "فني",
  productTaglineEn: "Home Maintenance",
  productTaglineAr: "صيانة منزلية",
  companyNameEn: "UpNexa",
  companyNameAr: "أب نكسا (UpNexa)",
  companyLegalEn: "UpNexa — Intelligent Systems & Digital Solutions",
  companyLegalAr: "شركة أنظمة ذكية وحلول رقمية متكاملة — UpNexa",
  website: "https://upnexa-eg.com",
  supportEmail: "Info@upnexa-eg.com",
  /** Android applicationId / iOS bundle id — changing this installs as a new app. */
  packageId: "com.fanni.app",
} as const;

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

export function getAppBuildNumber(): string {
  if (Platform.OS === "ios") {
    return String(Constants.expoConfig?.ios?.buildNumber ?? "0");
  }
  return String(Constants.expoConfig?.android?.versionCode ?? 0);
}

/** e.g. "1.0.7 (7)" — marketing version + Android versionCode / iOS buildNumber */
export function getAppVersionLabel(): string {
  return `${getAppVersion()} (${getAppBuildNumber()})`;
}

/** Sentry / diagnostics release string */
export function getAppReleaseId(): string {
  return `${APP_IDENTITY.packageId}@${getAppVersion()}+${getAppBuildNumber()}`;
}
