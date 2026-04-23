import nodemailer from "nodemailer";

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
    console.warn("[EMAIL] SMTP not configured — skipping welcome email.");
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
    console.error("[EMAIL] Failed to send welcome email:", err);
    return false;
  }
}

export async function sendPasswordResetCode(opts: SendResetCodeOptions): Promise<boolean> {
  const { to, code } = opts;

  const transporter = createTransporter();

  if (!transporter) {
    console.warn("[EMAIL] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS to enable email delivery.");
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
    console.error("[EMAIL] Failed to send reset code email:", err);
    return false;
  }
}
