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
  companyTaglineEn: "Digital solutions, software & AI that grow your business",
  companyTaglineAr: "حلول رقمية وتطبيقات تطوّر أعمالك وحياتك",
  website: "https://upnexa-eg.com",
  supportEmail: "Info@upnexa-eg.com",
  supportUrl: "https://upnexa-eg.com",
  termsClientUrl: "https://upnexa-eg.com/terms-client.html",
  termsTechUrl: "https://upnexa-eg.com/terms-tech.html",
  apiUrl: "https://api.upnexa-eg.com",
  /** APK download served from Expo web host (nginx location = /fanni.apk). */
  appDownloadUrl: "https://app.upnexa-eg.com/fanni.apk",
  appWebHost: "app.upnexa-eg.com",
  copyrightEn: "© UpNexa. All rights reserved.",
  copyrightAr: "© أب نكسا (UpNexa). جميع الحقوق محفوظة.",
  /** Android applicationId / iOS bundle id — changing this installs as a new app. */
  packageId: "com.fanni.app",
  publisherDomain: "upnexa-eg.com",
  /** Fallback when Expo Constants.expoConfig is missing (common on static web export). */
  version: "1.0.10",
  androidVersionCode: 10,
  iosBuildNumber: "10",
} as const;

/** Welcome points granted on technician approval (must match server WELCOME_BONUS_POINTS). */
export const WELCOME_BONUS_POINTS = 60;

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? APP_IDENTITY.version;
}

export function getAppBuildNumber(): string {
  if (Platform.OS === "ios") {
    return String(Constants.expoConfig?.ios?.buildNumber ?? APP_IDENTITY.iosBuildNumber);
  }
  return String(Constants.expoConfig?.android?.versionCode ?? APP_IDENTITY.androidVersionCode);
}

/** Marketing version only — e.g. "1.0.8" (no build parentheses). */
export function getAppVersionLabel(): string {
  return getAppVersion();
}

/** Sentry / diagnostics release string — keeps build number for telemetry only */
export function getAppReleaseId(): string {
  return `${APP_IDENTITY.packageId}@${getAppVersion()}+${getAppBuildNumber()}`;
}
