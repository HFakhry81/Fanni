import { logger } from "./logger";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

export async function sendExpoPushNotification(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const validMessages = messages.filter((m) => m.to && m.to.startsWith("ExponentPushToken["));
  if (validMessages.length === 0) {
    logger.warn("sendExpoPushNotification: no valid ExponentPushToken recipients, skipping");
    return;
  }

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validMessages),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text }, "Expo push API returned non-OK response");
      return;
    }

    const result = (await response.json()) as { data?: Array<{ status: string; message?: string; details?: unknown }> };
    const tickets = result.data ?? [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status !== "ok") {
        logger.warn({ ticket, to: validMessages[i]?.to }, "Expo push ticket was not ok");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to send Expo push notification");
  }
}

export async function sendOrderStatusPushNotification(
  pushToken: string,
  orderId: string,
  orderNumber: string,
  status: "accepted" | "inProgress" | "completed",
): Promise<void> {
  const titleMap: Record<string, string> = {
    accepted: "Technician On The Way",
    inProgress: "Work Has Started",
    completed: "Order Completed",
  };
  const bodyMap: Record<string, string> = {
    accepted: `Your order ${orderNumber} has been accepted by a technician.`,
    inProgress: `Work has started on your order ${orderNumber}.`,
    completed: `Your order ${orderNumber} has been completed.`,
  };

  await sendExpoPushNotification([
    {
      to: pushToken,
      title: titleMap[status] ?? "Order Update",
      body: bodyMap[status] ?? `Your order ${orderNumber} status changed to ${status}.`,
      data: { orderId, orderNumber, status, screen: "order-details" },
      sound: "default",
    },
  ]);
}
