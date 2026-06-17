import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "dummy";
  if (!baseURL) {
    throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL is not set");
  }
  return new OpenAI({ baseURL, apiKey });
}

function isSafeImageUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host) ||
    host === "0.0.0.0" ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    return false;
  }
  return true;
}

router.post("/ocr/receipt", authMiddleware, requireAuth, async (req, res) => {
  const { imageUrl } = req.body as { imageUrl?: string };

  if (!imageUrl || typeof imageUrl !== "string") {
    res.status(400).json({ error: "imageUrl is required" });
    return;
  }

  if (!isSafeImageUrl(imageUrl)) {
    res.status(400).json({ error: "Invalid or disallowed image URL" });
    return;
  }

  try {
    const openai = getOpenAIClient();

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `You are an OCR assistant that extracts receipt/invoice data from images.
Extract and return JSON with this exact structure:
{
  "supplier": "store/supplier name or null",
  "date": "YYYY-MM-DD or null",
  "items": [
    { "description": "item name", "qty": number, "unit": "piece/kg/etc or null", "unitPrice": number, "totalPrice": number }
  ],
  "subtotal": number,
  "tax": number or null,
  "detectedTotal": number
}
All prices in the same currency as the receipt. If a field cannot be determined, use null.
Return ONLY the JSON object, no markdown.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
            {
              type: "text",
              text: "Extract all receipt data from this image and return as JSON.",
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed: {
      supplier?: string | null;
      date?: string | null;
      items?: Array<{ description: string; qty: number; unit?: string | null; unitPrice: number; totalPrice: number }>;
      subtotal?: number;
      tax?: number | null;
      detectedTotal?: number;
    } = {};

    try {
      parsed = JSON.parse(content) as typeof parsed;
    } catch {
      logger.warn({ content }, "OCR response was not valid JSON, attempting extraction");
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
        } catch {
          logger.error({ content }, "Failed to parse OCR response JSON");
        }
      }
    }

    const lineItems = (parsed.items ?? []).map((item) => ({
      description: item.description ?? "",
      qty: Number(item.qty) || 1,
      unit: item.unit ?? null,
      unitPrice: Number(item.unitPrice) || 0,
      totalPrice: Number(item.totalPrice) || 0,
    }));

    const detectedTotal = Number(parsed.detectedTotal) || Number(parsed.subtotal) || 0;

    res.json({
      supplier: parsed.supplier ?? null,
      date: parsed.date ?? null,
      lineItems,
      detectedTotal,
    });
  } catch (err) {
    logger.error({ err }, "OCR receipt extraction failed");
    res.status(500).json({ error: "OCR processing failed. Please enter the amount manually." });
  }
});

export default router;
