interface SendWelcomeSmsOptions {
  to: string;
  name: string;
  role: "client" | "technician";
}

async function sendSmsViaProvider(to: string, body: string): Promise<boolean> {
  const apiKey = process.env.SMS_API_KEY;
  const apiSecret = process.env.SMS_API_SECRET;
  const sender = process.env.SMS_SENDER_ID ?? "Fanni";

  if (!apiKey) {
    console.warn(`[SMS] SMS_API_KEY not configured — skipping SMS to ${to.slice(0, 4)}****`);
    return false;
  }

  const provider = (process.env.SMS_PROVIDER ?? "vonage").toLowerCase();

  try {
    if (provider === "vonage" || provider === "nexmo") {
      const res = await fetch("https://rest.nexmo.com/sms/json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          from: sender,
          to,
          text: body,
        }),
      });
      const data = (await res.json()) as { messages?: Array<{ status: string }> };
      const status = data?.messages?.[0]?.status;
      if (status !== "0") {
        console.error("[SMS] Vonage returned non-zero status:", status);
        return false;
      }
      return true;
    }

    if (provider === "twilio") {
      const accountSid = apiKey;
      const authToken = apiSecret ?? "";
      const fromNumber = process.env.SMS_FROM_NUMBER ?? sender;
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const body2 = new URLSearchParams({ To: to, From: fromNumber, Body: body });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body2.toString(),
        },
      );
      if (!res.ok) {
        const err = await res.text();
        console.error("[SMS] Twilio error:", err);
        return false;
      }
      return true;
    }

    console.warn(`[SMS] Unknown SMS_PROVIDER "${provider}" — skipping SMS.`);
    return false;
  } catch (err) {
    console.error("[SMS] Failed to send SMS:", err);
    return false;
  }
}

export async function sendWelcomeSms(opts: SendWelcomeSmsOptions): Promise<boolean> {
  const { to, name, role } = opts;
  const firstName = name.trim().split(/\s+/)[0] ?? name.trim();

  const roleAr = role === "technician" ? "فني" : "عميل";
  const nextStepsAr =
    role === "technician"
      ? "فعّل تواجدك من خريطة فني لتبدأ استقبال الطلبات."
      : "تصفح الخدمات المتاحة واطلب فنياً متخصصاً بنقرة واحدة.";
  const nextStepsEn =
    role === "technician"
      ? "Enable your availability on the Fanni map to start receiving orders."
      : "Browse available services and book a specialist with just one tap.";

  const message =
    `مرحباً ${firstName}! شكراً لتسجيلك كـ${roleAr} في فني. ${nextStepsAr}\n\n` +
    `Welcome to Fanni, ${firstName}! ${nextStepsEn}`;

  return sendSmsViaProvider(to, message);
}
