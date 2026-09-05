import { Router, type IRouter, type Request } from "express";
import twilio from "twilio";
import { and, eq } from "drizzle-orm";
import { db, maskedCallSessionsTable, ordersTable, usersTable, leadUnlocksTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { toE164Egypt } from "../lib/phone";
import { getPublicApiUrl, isMaskedCallingConfigured, placeMaskedBridgeCall } from "../lib/maskedCall";

const router: IRouter = Router();
const { VoiceResponse } = twilio.twiml;

const ALLOWED_STATUSES = ["acknowledged", "en_route", "arrived", "in_progress"];

function validateTwilioSignature(req: Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers["x-twilio-signature"];
  if (!authToken || typeof signature !== "string") return false;
  const publicBase = getPublicApiUrl();
  const url = `${publicBase}${req.originalUrl}`;
  return twilio.validateRequest(authToken, signature, url, req.body as Record<string, string>);
}

router.post("/orders/:id/masked-call", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const orderId = req.params.id;

  if (user.role !== "technician" && user.role !== "client") {
    res.status(403).json({ error: "Only the client or assigned technician can start a masked call" });
    return;
  }

  if (!isMaskedCallingConfigured()) {
    // Do not block the journey — mark contact intent and let WhatsApp / normal dial continue.
    try {
      await db.update(leadUnlocksTable).set({ clickedCall: true })
        .where(and(eq(leadUnlocksTable.orderId, orderId), eq(leadUnlocksTable.technicianId, user.id)));
    } catch {
      /* ignore */
    }
    res.status(200).json({
      success: true,
      skipped: true,
      code: "MASKED_CALL_UNAVAILABLE",
      message:
        "الاتصال المقنّع غير مفعّل على الخادم حالياً. كمّل عبر واتساب أو الاتصال العادي من التطبيق — الرحلة مستمرة.",
    });
    return;
  }

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (!ALLOWED_STATUSES.includes(order.status)) {
      res.status(409).json({ error: "Calls are only allowed while the technician is assigned" });
      return;
    }

    const clientId = order.clientId;
    const technicianId = order.technicianId;
    if (!clientId || !technicianId) {
      res.status(409).json({ error: "Order is missing a client or technician" });
      return;
    }

    if (user.role === "client" && clientId !== user.id) {
      res.status(403).json({ error: "You are not the client for this order" }); return;
    }
    if (user.role === "technician" && technicianId !== user.id) {
      res.status(403).json({ error: "You are not assigned to this order" }); return;
    }

    if (user.role === "technician") {
      const [unlock] = await db.select({ id: leadUnlocksTable.id }).from(leadUnlocksTable)
        .where(and(eq(leadUnlocksTable.technicianId, user.id), eq(leadUnlocksTable.orderId, orderId)))
        .limit(1);
      if (!unlock) {
        res.status(409).json({ error: "Lead must be unlocked before calling" });
        return;
      }
    }

    const destinationUserId = user.role === "technician" ? clientId : technicianId;
    const [initiatorRow] = await db.select({ mobile: usersTable.mobile }).from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    const [destinationRow] = await db.select({ mobile: usersTable.mobile }).from(usersTable).where(eq(usersTable.id, destinationUserId)).limit(1);

    const initiatorE164 = toE164Egypt(initiatorRow?.mobile);
    const data = (order.data ?? {}) as Record<string, unknown>;
    let destinationRaw = destinationRow?.mobile ?? null;
    if (user.role === "technician") {
      destinationRaw = destinationRaw ?? (typeof data.clientMobile === "string" ? data.clientMobile : null);
    } else {
      destinationRaw = destinationRaw ?? (typeof data.technicianMobile === "string" ? data.technicianMobile : null);
    }
    const destinationE164 = toE164Egypt(destinationRaw);

    if (!initiatorE164 || !destinationE164) {
      res.status(409).json({
        error: "A valid mobile number is required for both parties",
        message: "مفيش رقم صالح للاتصال. تأكد إن الموبايل متسجل صح.",
      });
      return;
    }

    const [session] = await db.insert(maskedCallSessionsTable).values({
      orderId,
      initiatorUserId: user.id,
      destinationUserId,
      destinationE164,
      provider: "twilio",
      status: "queued",
    }).returning();

    if (user.role === "technician") {
      await db.update(leadUnlocksTable)
        .set({ clickedCall: true })
        .where(and(eq(leadUnlocksTable.technicianId, user.id), eq(leadUnlocksTable.orderId, orderId)));
    }

    await placeMaskedBridgeCall({ sessionId: session!.id, initiatorE164 });

    res.json({
      success: true,
      sessionId: session!.id,
      message: "هيتصل بيك رقم المنصة دلوقتي. ارفع السماعة عشان نوصّلك بالطرف التاني من غير ما الأرقام تظهر.",
    });
  } catch (err) {
    logger.error({ err, orderId, userId: user.id }, "Failed to start masked call");
    res.status(500).json({ error: "Failed to start masked call" });
  }
});

router.post("/voice/bridge", async (req, res) => {
  if (!validateTwilioSignature(req)) {
    res.status(403).type("text/plain").send("Forbidden");
    return;
  }
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  const response = new VoiceResponse();
  try {
    const [session] = sessionId
      ? await db.select().from(maskedCallSessionsTable).where(eq(maskedCallSessionsTable.id, sessionId)).limit(1)
      : [];
    if (!session) {
      response.say({ language: "ar-EG" as "ar-AE" }, "تعذر إكمال الاتصال.");
      res.type("text/xml").send(response.toString());
      return;
    }
    const [order] = await db.select({ status: ordersTable.status }).from(ordersTable).where(eq(ordersTable.id, session.orderId)).limit(1);
    if (!order || !ALLOWED_STATUSES.includes(order.status)) {
      response.say({ language: "ar-EG" as "ar-AE" }, "الطلب لم يعد متاحا للاتصال.");
      res.type("text/xml").send(response.toString());
      return;
    }
    response.say({ language: "ar-EG" as "ar-AE" }, "جاري توصيلك عبر منصة فني.");
    const dial = response.dial({
      callerId: process.env.TWILIO_VOICE_NUMBER,
      timeout: 25,
    });
    dial.number(session.destinationE164);
    res.type("text/xml").send(response.toString());
  } catch (err) {
    logger.error({ err, sessionId }, "Masked call TwiML failed");
    response.say({ language: "ar-EG" as "ar-AE" }, "حدث خطأ. حاول مرة أخرى.");
    res.type("text/xml").send(response.toString());
  }
});

router.post("/voice/status", async (req, res) => {
  if (!validateTwilioSignature(req)) {
    res.status(403).send("Forbidden");
    return;
  }
  const callSid = typeof req.body?.CallSid === "string" ? req.body.CallSid : "";
  const callStatus = typeof req.body?.CallStatus === "string" ? req.body.CallStatus : "";
  if (callSid && callStatus) {
    await db.update(maskedCallSessionsTable)
      .set({ status: callStatus, updatedAt: new Date() })
      .where(eq(maskedCallSessionsTable.providerCallSid, callSid));
  }
  res.sendStatus(204);
});

export default router;
