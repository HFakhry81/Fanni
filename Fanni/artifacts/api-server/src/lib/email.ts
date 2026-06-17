import nodemailer from "nodemailer";
import { logger } from "./logger";
import { generateClientInvoicePdf, generateTechnicianPayoutPdf, type InvoiceData } from "./invoicePdf.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

interface SendResetCodeOptions {
  to: string;
  code: string;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

interface SendWelcomeOptions {
  to: string;
  name: string;
  role: "client" | "technician";
}

export async function sendWelcomeEmail(opts: SendWelcomeOptions): Promise<boolean> {
  const { to, name, role } = opts;

  const transporter = createTransporter();

  if (!transporter) {
    logger.warn("[EMAIL] SMTP not configured — skipping welcome email.");
    return false;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const subject = "مرحباً بك في فني | Welcome to Fanni";

  const roleAr = role === "technician" ? "فني" : "عميل";
  const nextStepsAr =
    role === "technician"
      ? "فعّل تواجدك من خريطة فني لتبدأ استقبال الطلبات."
      : "تصفح الخدمات المتاحة واطلب فنياً متخصصاً بنقرة واحدة.";
  const nextStepsEn =
    role === "technician"
      ? "Enable your availability on the Fanni map to start receiving orders."
      : "Browse available services and book a specialist with just one tap.";
  const firstName = name.trim().split(/\s+/)[0] ?? name.trim();

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f8;padding:32px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h2 style="color:#F5A623;margin-top:0;">مرحباً بك في فني، ${firstName}!</h2>
    <p style="color:#333;line-height:1.6;">شكراً لتسجيلك كـ<strong>${roleAr}</strong> في منصة فني لخدمات الصيانة المنزلية.</p>
    <p style="color:#333;line-height:1.6;">${nextStepsAr}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="color:#999;font-size:13px;direction:ltr;text-align:left;">
      Welcome to Fanni, ${firstName}!<br/>
      ${nextStepsEn}
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="color:#aaa;font-size:11px;text-align:center;">Fanni — Home Maintenance Services</p>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({ from, to, subject, html });
    return true;
  } catch (err) {
    logger.error({ err }, "[EMAIL] Failed to send welcome email");
    return false;
  }
}

export async function sendPasswordResetCode(opts: SendResetCodeOptions): Promise<boolean> {
  const { to, code } = opts;

  const transporter = createTransporter();

  if (!transporter) {
    logger.warn("[EMAIL] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS to enable email delivery.");
    return false;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

  const subject = "Fanni — Password Reset Code | رمز إعادة تعيين كلمة المرور";
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f8;padding:32px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h2 style="color:#F5A623;margin-top:0;">فني — استعادة كلمة المرور</h2>
    <p style="color:#333;line-height:1.6;">لقد طلبت إعادة تعيين كلمة المرور الخاصة بك. استخدم الرمز أدناه لإتمام العملية:</p>
    <div style="background:#FFF8EC;border:2px solid #F5A623;border-radius:10px;padding:20px;text-align:center;margin:24px 0;">
      <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#F5A623;">${code}</span>
    </div>
    <p style="color:#666;font-size:13px;">الرمز صالح لمدة <strong>15 دقيقة</strong> فقط.</p>
    <p style="color:#666;font-size:13px;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="color:#aaa;font-size:11px;text-align:center;">Fanni — Home Maintenance Services</p>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({ from, to, subject, html });
    return true;
  } catch (err) {
    logger.error({ err }, "[EMAIL] Failed to send reset code email");
    return false;
  }
}

export interface SendInvoiceEmailsOptions {
  invoiceData: InvoiceData;
  clientEmail: string | null | undefined;
  technicianEmail: string | null | undefined;
}

export async function sendInvoiceEmails(opts: SendInvoiceEmailsOptions): Promise<{ clientSent: boolean; technicianSent: boolean }> {
  const { invoiceData, clientEmail, technicianEmail } = opts;
  const transporter = createTransporter();
  const result = { clientSent: false, technicianSent: false };

  if (!transporter) {
    logger.warn("[EMAIL] SMTP not configured — skipping invoice emails.");
    return result;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const orderRef = `Order #${invoiceData.orderNumber}`;

  if (clientEmail) {
    try {
      const pdfBuffer = await generateClientInvoicePdf({ ...invoiceData, technicianEmail: undefined });
      const subject = `Fanni — Invoice for ${orderRef}`;
      const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f8;padding:32px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h2 style="color:#F5A623;margin-top:0;">Your Fanni Invoice</h2>
    <p style="color:#333;line-height:1.6;">Hi ${escapeHtml(invoiceData.clientName)},</p>
    <p style="color:#333;line-height:1.6;">
      Your ${escapeHtml(invoiceData.category)} service has been completed. Please find your invoice attached.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="color:#666;padding:6px 0;font-size:14px;">${orderRef}</td>
        <td style="color:#F5A623;font-weight:bold;text-align:right;font-size:14px;">EGP ${invoiceData.clientTotal.toFixed(2)}</td>
      </tr>
    </table>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="color:#aaa;font-size:11px;text-align:center;">Fanni — Home Maintenance Services</p>
  </div>
</body>
</html>`;
      await transporter.sendMail({
        from,
        to: clientEmail,
        subject,
        html,
        attachments: [{ filename: `fanni-invoice-${invoiceData.orderNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
      });
      result.clientSent = true;
      logger.info(`[EMAIL] Client invoice sent to ${clientEmail} for order ${invoiceData.orderNumber}`);
    } catch (err) {
      logger.error({ err }, "[EMAIL] Failed to send client invoice email");
    }
  }

  if (technicianEmail) {
    try {
      const pdfBuffer = await generateTechnicianPayoutPdf({ ...invoiceData, clientEmail: undefined });
      const subject = `Fanni — Payout Statement for ${orderRef}`;
      const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f8;padding:32px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h2 style="color:#F5A623;margin-top:0;">Your Fanni Payout Statement</h2>
    <p style="color:#333;line-height:1.6;">Hi ${escapeHtml(invoiceData.technicianName)},</p>
    <p style="color:#333;line-height:1.6;">
      You've completed a ${escapeHtml(invoiceData.category)} job. Your payout statement is attached.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="color:#666;padding:6px 0;font-size:14px;">${orderRef}</td>
        <td style="color:#F5A623;font-weight:bold;text-align:right;font-size:14px;">EGP ${invoiceData.techNetTotal.toFixed(2)}</td>
      </tr>
    </table>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="color:#aaa;font-size:11px;text-align:center;">Fanni — Home Maintenance Services</p>
  </div>
</body>
</html>`;
      await transporter.sendMail({
        from,
        to: technicianEmail,
        subject,
        html,
        attachments: [{ filename: `fanni-payout-${invoiceData.orderNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
      });
      result.technicianSent = true;
      logger.info(`[EMAIL] Technician payout sent to ${technicianEmail} for order ${invoiceData.orderNumber}`);
    } catch (err) {
      logger.error({ err }, "[EMAIL] Failed to send technician payout email");
    }
  }

  return result;
}
