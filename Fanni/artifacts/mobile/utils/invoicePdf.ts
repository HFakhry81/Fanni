import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import { readAsStringAsync } from "expo-file-system/legacy";
import { Alert } from "react-native";
import { Order, ThreePartyInvoice } from "@/context/OrderContext";

export type TranslateFn = (key: string) => string;

async function loadLogoDataUri(): Promise<string> {
  try {
    const asset = Asset.fromModule(require("@/assets/images/icon.png"));
    await asset.downloadAsync();
    if (asset.localUri) {
      const base64 = await readAsStringAsync(asset.localUri, { encoding: "base64" });
      return `data:image/png;base64,${base64}`;
    }
  } catch (err) {
    console.warn("[ShareInvoice] Could not load logo asset:", err);
  }
  return "";
}

async function printAndShare(html: string, dialogTitle: string, t: TranslateFn): Promise<void> {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle, UTI: "com.adobe.pdf" });
    } else {
      Alert.alert(t("invoice.title"), uri);
    }
  } catch {
    Alert.alert(t("common.error") || "Error", t("invoice.shareError"));
  }
}

function buildLogoImg(logoDataUri: string, isRTL: boolean): string {
  return logoDataUri
    ? `<img src="${logoDataUri}" style="width:48px;height:48px;object-fit:contain;margin-${isRTL ? "left" : "right"}:12px" />`
    : "";
}

export async function shareLegacyInvoicePdf({
  order,
  isRTL,
  t,
}: {
  order: Order;
  isRTL: boolean;
  t: TranslateFn;
}): Promise<void> {
  const inv = order.invoice;
  if (!inv) return;

  const dir = isRTL ? "rtl" : "ltr";
  const logoDataUri = await loadLogoDataUri();
  const logoImg = buildLogoImg(logoDataUri, isRTL);

  const categoryKey = `cat.${order.category}`;
  const categoryLabel = (() => { const l = t(categoryKey); return l === categoryKey ? order.category : l; })();

  const rows = [
    [t("invoice.materials"), inv.materialsTotal],
    [t("invoice.materialsMark"), inv.materialsMark],
    [t("invoice.labor"), inv.laborFee],
    [t("invoice.tools"), inv.toolRental],
    [t("invoice.tax"), inv.tax],
    [t("invoice.vat"), inv.vat],
  ]
    .map(
      ([label, val]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:${isRTL ? "left" : "right"};font-weight:500">${val} ${t("common.egp")}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isRTL ? "ar" : "en"}">
<head>
<meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#111827;direction:${dir}}
  .header{display:flex;flex-direction:${isRTL ? "row-reverse" : "row"};align-items:center;border-bottom:2px solid #f59e0b;padding-bottom:16px;margin-bottom:24px}
  .brand{flex:1;font-size:20px;font-weight:700;color:#111827;text-align:${isRTL ? "right" : "left"}}
  .invoice-num{font-size:12px;color:#6b7280}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  .total-row{background:#fef3c7;font-weight:700;font-size:16px}
  .total-row td{padding:12px;color:#d97706}
  h2{font-size:18px;margin:0 0 16px;text-align:${isRTL ? "right" : "left"}}
  .meta{background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .meta-item{display:flex;flex-direction:column;gap:2px}
  .meta-label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em}
  .meta-value{font-size:14px;font-weight:600;color:#111827}
</style>
</head>
<body>
<div class="header">
  ${logoImg}
  <div class="brand">${isRTL ? "فني · FANNI" : "FANNI · فني"}</div>
  <div class="invoice-num">#${inv.invoiceNumber}</div>
</div>
<h2>${t("invoice.title")} #${inv.invoiceNumber}</h2>
<div class="meta">
  <div class="meta-item">
    <span class="meta-label">${t("invoice.client")}</span>
    <span class="meta-value">${order.clientName}</span>
  </div>
  <div class="meta-item">
    <span class="meta-label">${t("invoice.orderNumber")}</span>
    <span class="meta-value">${order.orderNumber}</span>
  </div>
  <div class="meta-item">
    <span class="meta-label">${t("invoice.date")}</span>
    <span class="meta-value">${new Date(order.visitDate).toLocaleDateString(isRTL ? "ar-EG" : "en-GB", { year: "numeric", month: "long", day: "numeric" })}</span>
  </div>
  <div class="meta-item">
    <span class="meta-label">${t("invoice.category")}</span>
    <span class="meta-value">${categoryLabel}</span>
  </div>
  ${order.subCategory ? `<div class="meta-item">
    <span class="meta-label">${t("invoice.subCategory")}</span>
    <span class="meta-value">${order.subCategory}</span>
  </div>` : ""}
  ${order.technicianName ? `<div class="meta-item">
    <span class="meta-label">${t("invoice.technician")}</span>
    <span class="meta-value">${order.technicianName}</span>
  </div>` : ""}
  ${order.technicianMobile ? `<div class="meta-item">
    <span class="meta-label">${t("invoice.phone")}</span>
    <span class="meta-value" style="direction:ltr;unicode-bidi:plaintext">${order.technicianMobile}</span>
  </div>` : ""}
</div>
<table>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td>${t("invoice.total")}</td>
      <td style="text-align:${isRTL ? "left" : "right"}">${inv.total} ${t("common.egp")}</td>
    </tr>
  </tbody>
</table>
</body>
</html>`;

  await printAndShare(html, `${t("invoice.title")} #${inv.invoiceNumber}`, t);
}

export async function shareThreePartyInvoicePdf({
  inv3,
  isTechnician,
  isRTL,
  t,
}: {
  inv3: ThreePartyInvoice;
  isTechnician: boolean;
  isRTL: boolean;
  t: TranslateFn;
}): Promise<void> {
  const dir = isRTL ? "rtl" : "ltr";
  const logoDataUri = await loadLogoDataUri();
  const logoImg = buildLogoImg(logoDataUri, isRTL);
  const egp = t("common.egp");
  const SERVICE_FEE_RATE = inv3.serviceFeeRate ?? 15;
  const VAT_RATE = inv3.vatRate ?? 14;

  const negCell = (v: number) =>
    `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:${isRTL ? "left" : "right"};font-weight:500;color:#dc2626">−${v.toFixed(2)} ${egp}</td>`;
  const posCell = (v: number) =>
    `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:${isRTL ? "left" : "right"};font-weight:500">${v.toFixed(2)} ${egp}</td>`;
  const labelCell = (l: string) =>
    `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${l}</td>`;

  const sharedStyle = `body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#111827;direction:${dir}}.header{display:flex;flex-direction:${isRTL ? "row-reverse" : "row"};align-items:center;border-bottom:2px solid #f59e0b;padding-bottom:16px;margin-bottom:24px}.brand{flex:1;font-size:20px;font-weight:700}table{width:100%;border-collapse:collapse;margin-bottom:20px}.total-row{background:#fef3c7;font-weight:700;font-size:16px}.total-row td{padding:12px;color:#d97706}h2{font-size:18px;margin:0 0 16px;text-align:${isRTL ? "right" : "left"}}`;

  let rows: string;
  let invoiceTitle: string;
  let grandTotal: number;

  if (isTechnician) {
    invoiceTitle = isRTL ? "دفعة الفني" : "Technician Payout";
    grandTotal = inv3.techNetTotal;
    rows = [
      `<tr>${labelCell(isRTL ? "تكلفة المواد" : "Materials Cost")}${posCell(inv3.materialsTotal)}</tr>`,
      inv3.transportFee > 0 ? `<tr>${labelCell(isRTL ? "تكلفة النقل" : "Transport")}${posCell(inv3.transportFee)}</tr>` : "",
      `<tr>${labelCell(isRTL ? "أجر العمالة" : "Labour Fee")}${posCell(inv3.labourFee)}</tr>`,
      `<tr>${labelCell(isRTL ? `خصم رسوم الخدمة (${SERVICE_FEE_RATE}%)` : `Service Fee Deduction (${SERVICE_FEE_RATE}%)`)}${negCell(inv3.serviceFeeAmount)}</tr>`,
    ].join("");
  } else {
    invoiceTitle = isRTL ? "فاتورة العميل" : "Client Invoice";
    grandTotal = inv3.clientTotal;
    rows = [
      `<tr>${labelCell(isRTL ? "تكلفة المواد" : "Materials Cost")}${posCell(inv3.materialsTotal)}</tr>`,
      inv3.transportFee > 0 ? `<tr>${labelCell(isRTL ? "تكلفة النقل" : "Transport")}${posCell(inv3.transportFee)}</tr>` : "",
      `<tr>${labelCell(isRTL ? "أجر العمالة" : "Labour Fee")}${posCell(inv3.labourFee)}</tr>`,
      `<tr>${labelCell(isRTL ? `رسوم الخدمة (${SERVICE_FEE_RATE}%)` : `Service Fee (${SERVICE_FEE_RATE}%)`)}${posCell(inv3.serviceFeeAmount)}</tr>`,
      `<tr>${labelCell(isRTL ? `ضريبة القيمة المضافة (${VAT_RATE}%)` : `VAT (${VAT_RATE}%)`)}${posCell(inv3.vatAmount)}</tr>`,
    ].join("");
  }

  const html = `<!DOCTYPE html><html dir="${dir}" lang="${isRTL ? "ar" : "en"}"><head><meta charset="UTF-8"/>
<style>${sharedStyle}</style>
</head><body>
<div class="header">${logoImg}<div class="brand">${isRTL ? "فني · FANNI" : "FANNI · فني"}</div></div>
<h2>${invoiceTitle}</h2>
<table><tbody>${rows}<tr class="total-row"><td>${isRTL ? "الإجمالي" : "Total"}</td><td style="text-align:${isRTL ? "left" : "right"}">${grandTotal.toFixed(2)} ${egp}</td></tr></tbody></table>
</body></html>`;

  await printAndShare(html, invoiceTitle, t);
}

export async function shareTechPayoutInvoicePdf({
  order,
  isRTL,
  t,
}: {
  order: Order;
  isRTL: boolean;
  t: TranslateFn;
}): Promise<void> {
  const inv = order.threePartyInvoice;
  if (!inv) return;

  const dir = isRTL ? "rtl" : "ltr";
  const logoDataUri = await loadLogoDataUri();
  const logoImg = buildLogoImg(logoDataUri, isRTL);
  const egp = t("common.egp");
  const SERVICE_FEE_RATE = inv.serviceFeeRate ?? 15;

  const rowsHtml = [
    [isRTL ? "تكلفة المواد" : "Materials Cost", inv.materialsTotal],
    [isRTL ? "تكلفة النقل" : "Transport", inv.transportFee],
    [isRTL ? "أجر العمالة" : "Labour Fee", inv.labourFee],
    [isRTL ? `خصم رسوم الخدمة (${SERVICE_FEE_RATE}%)` : `Service Fee Deduction (${SERVICE_FEE_RATE}%)`, -inv.serviceFeeAmount],
  ]
    .filter(([, v]) => (v as number) !== 0)
    .map(
      ([label, val]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:${isRTL ? "left" : "right"};font-weight:500;color:${(val as number) < 0 ? "#ef4444" : "#111827"}">${(val as number) >= 0 ? "" : "−"}${Math.abs(val as number).toFixed(2)} ${egp}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isRTL ? "ar" : "en"}">
<head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#111827;direction:${dir}}
  .header{display:flex;flex-direction:${isRTL ? "row-reverse" : "row"};align-items:center;border-bottom:2px solid #f59e0b;padding-bottom:16px;margin-bottom:24px}
  .brand{flex:1;font-size:20px;font-weight:700;color:#111827;text-align:${isRTL ? "right" : "left"}}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  .total-row{background:#fef3c7;font-weight:700;font-size:16px}
  .total-row td{padding:12px;color:#d97706}
  h2{font-size:18px;margin:0 0 16px;text-align:${isRTL ? "right" : "left"}}
  .badge{display:inline-block;background:#fef3c7;color:#d97706;padding:4px 12px;border-radius:20px;font-size:12px;margin-bottom:16px}
</style>
</head>
<body>
<div class="header">${logoImg}<div class="brand">${isRTL ? "فني · FANNI" : "FANNI · فني"}</div></div>
<div class="badge">${isRTL ? "فاتورة الفني" : "Technician Invoice"}</div>
<h2>${isRTL ? "تفاصيل الدفعة" : "Payout Details"}</h2>
<table><tbody>${rowsHtml}
<tr class="total-row"><td>${isRTL ? "صافي المستحق" : "Net Payout"}</td><td style="text-align:${isRTL ? "left" : "right"}">${inv.techNetTotal.toFixed(2)} ${egp}</td></tr>
</tbody></table>
</body></html>`;

  const dialogTitle = isRTL ? "فاتورة الفني" : "Technician Invoice";
  await printAndShare(html, dialogTitle, t);
}

export async function shareOrderInvoicePdf({
  order,
  threePartyInvoice,
  isTechnician,
  isRTL,
  t,
}: {
  order: Order;
  threePartyInvoice?: ThreePartyInvoice | null;
  isTechnician?: boolean;
  isRTL: boolean;
  t: TranslateFn;
}): Promise<void> {
  if (threePartyInvoice) {
    await shareThreePartyInvoicePdf({ inv3: threePartyInvoice, isTechnician: !!isTechnician, isRTL, t });
    return;
  }
  if (order.invoice) {
    await shareLegacyInvoicePdf({ order, isRTL, t });
  }
}
