import * as WebBrowser from "expo-web-browser";

export type TermsAudience = "client" | "technician";

/** Hosted on upnexa-eg.com public/ (WinSCP → /var/www/upnexa-eg.com/public/). */
export const TERMS_URLS = {
  client: "https://upnexa-eg.com/terms-client.html",
  technician: "https://upnexa-eg.com/terms-tech.html",
} as const;

export function getTermsUrl(audience: TermsAudience): string {
  return TERMS_URLS[audience];
}

export async function openTermsOfUse(audience: TermsAudience): Promise<void> {
  await WebBrowser.openBrowserAsync(getTermsUrl(audience), {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
