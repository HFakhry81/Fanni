import { useEffect, useRef } from "react";
import { useOrders, Order } from "@/context/OrderContext";
import { User } from "@/context/AppContext";

const WS_RECONNECT_DELAY_MS = 3000;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  electricity: ["electrician", "electric", "electrical", "كهرباء", "كهربائي"],
  plumbing: ["plumber", "plumbing", "سباكة", "سباك"],
  ac: ["ac", "air conditioning", "hvac", "تكييف", "مكيفات"],
  carpentry: ["carpenter", "carpentry", "نجارة", "نجار"],
  appliances: ["appliances", "appliance", "electronics", "أجهزة"],
  painting: ["painting", "painter", "دهانات", "دهان"],
  pest: ["pest", "pest control", "حشرات", "مكافحة"],
  flooring: ["flooring", "floor", "tiles", "أرضيات", "بلاط"],
};

function professionToCategory(profession: string): string | undefined {
  const lower = profession.trim().toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return undefined;
}

function getWsUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  if (!domain) return "";
  return `wss://${domain}/api/ws`;
}

function buildRegisterMessage(user: User | null): string {
  const payload: Record<string, string | boolean> = { type: "register", isAvailable: true };

  if (user?.profession) {
    const category = professionToCategory(user.profession);
    if (category) {
      payload.category = category;
    }
  }

  if (user?.governorate) {
    payload.governorate = user.governorate.toLowerCase();
  }

  if (user?.area) {
    payload.area = user.area.toLowerCase();
  }

  return JSON.stringify(payload);
}

export function useOrderNotifications(isOnline: boolean = true, user: User | null = null) {
  const { injectNewOrder } = useOrders();
  const injectRef = useRef(injectNewOrder);
  injectRef.current = injectNewOrder;

  const userRef = useRef(user);
  userRef.current = user;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function disconnect() {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    }

    function connect() {
      const url = getWsUrl();
      if (!url) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        ws.send(buildRegisterMessage(userRef.current));
      };

      ws.onmessage = (event) => {
        if (!isOnline) return;
        try {
          const data = JSON.parse(event.data as string);
          if (data.type === "new_order" && data.order) {
            const order = data.order as Order;
            injectRef.current({ ...order, createdAt: order.createdAt ?? new Date().toISOString() });
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current && isOnline) {
          console.warn("[Fanni] Order notification WS closed. Reconnecting in", WS_RECONNECT_DELAY_MS, "ms...");
          reconnectTimerRef.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = (event) => {
        console.warn("[Fanni] Order notification WS error:", event);
        ws.close();
      };
    }

    if (isOnline) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(buildRegisterMessage(user));
  }, [user?.id, user?.profession, user?.governorate, user?.area, isOnline]);
}
