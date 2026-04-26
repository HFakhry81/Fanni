import { useEffect, useRef } from "react";
import { useOrders, Order } from "@/context/OrderContext";
import { User } from "@/context/AppContext";


const WS_BASE_RECONNECT_DELAY_MS = 3000;
const WS_MAX_RECONNECT_DELAY_MS = 60000;

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

function buildRegisterMessage(user: User | null, sessionToken: string | null, forceUnavailable?: boolean): string {
  const payload: Record<string, unknown> = { type: "register", isAvailable: forceUnavailable ? false : true };

  if (sessionToken) {
    payload.token = sessionToken;
  }

  if (!forceUnavailable) {
    if (user?.serviceCategories && user.serviceCategories.length > 0) {
      payload.categories = user.serviceCategories.map((c) => c.toLowerCase());
    } else if (user?.profession) {
      const category = professionToCategory(user.profession);
      if (category) {
        payload.categories = [category];
      }
    }

    if (user?.governorate) {
      payload.governorate = user.governorate.toLowerCase();
    }

    if (user?.area) {
      payload.area = user.area.toLowerCase();
    }
  }

  return JSON.stringify(payload);
}

export function useOrderNotifications(
  isOnline: boolean = true,
  user: User | null = null,
  sessionToken: string | null = null,
  onNewOrder?: () => void,
  onOrderCancelled?: (orderId: string) => void,
  onAvailabilityChangedByAdmin?: (isAvailable: boolean) => void,
  alwaysConnect: boolean = false,
) {
  const { injectNewOrder, removePendingOrder, bumpWsOrderStatusSignal, updateOrder } = useOrders();
  const injectRef = useRef(injectNewOrder);
  const removeRef = useRef(removePendingOrder);
  const bumpSignalRef = useRef(bumpWsOrderStatusSignal);
  const updateOrderRef = useRef(updateOrder);
  bumpSignalRef.current = bumpWsOrderStatusSignal;
  updateOrderRef.current = updateOrder;
  const onNewOrderRef = useRef(onNewOrder);
  const onOrderCancelledRef = useRef(onOrderCancelled);
  const onAvailabilityChangedByAdminRef = useRef(onAvailabilityChangedByAdmin);
  onNewOrderRef.current = onNewOrder;
  onOrderCancelledRef.current = onOrderCancelled;
  onAvailabilityChangedByAdminRef.current = onAvailabilityChangedByAdmin;
  injectRef.current = injectNewOrder;
  removeRef.current = removePendingOrder;

  const userRef = useRef(user);
  userRef.current = user;

  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const authRejectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    authRejectedRef.current = false;
    reconnectAttemptsRef.current = 0;

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
        reconnectAttemptsRef.current = 0;
        ws.send(buildRegisterMessage(userRef.current, sessionTokenRef.current, alwaysConnect));
      };

      ws.onmessage = (event) => {
        if (!isOnline && !alwaysConnect) return;
        try {
          const data = JSON.parse(event.data as string);
          if (data.type === "ping") {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "pong" }));
            }
            return;
          }
          if (data.type === "auth_error") {
            console.warn("[Fanni] WebSocket auth rejected:", data.message);
            authRejectedRef.current = true;
            ws.close();
            return;
          }
          if (data.type === "new_order" && data.order) {
            const order = data.order as Order;
            injectRef.current({ ...order, createdAt: order.createdAt ?? new Date().toISOString() });
            onNewOrderRef.current?.();
          }
          if (data.type === "order_cancelled" && data.orderId) {
            const oid = data.orderId as string;
            removeRef.current(oid);
            onOrderCancelledRef.current?.(oid);
          }
          if (data.type === "order_status_update" && data.update && data.update.id) {
            const { id, ...fields } = data.update as { id: string } & Partial<Order>;
            updateOrderRef.current(id, fields);
            bumpSignalRef.current();
          }
          if (data.type === "availability_changed_by_admin" && typeof data.isAvailable === "boolean") {
            onAvailabilityChangedByAdminRef.current?.(data.isAvailable as boolean);
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current && isOnline && !authRejectedRef.current) {
          const delay = Math.min(
            WS_BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current),
            WS_MAX_RECONNECT_DELAY_MS
          );
          reconnectAttemptsRef.current += 1;
          console.warn("[Fanni] Order notification WS closed. Reconnecting in", delay, "ms...");
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (event) => {
        console.warn("[Fanni] Order notification WS error:", event);
        ws.close();
      };
    }

    if (isOnline || alwaysConnect) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [isOnline, alwaysConnect, sessionToken]);

  useEffect(() => {
    if (!isOnline && !alwaysConnect) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    authRejectedRef.current = false;
    ws.send(buildRegisterMessage(user, sessionTokenRef.current, alwaysConnect));
  }, [user?.id, user?.profession, user?.serviceCategories, user?.governorate, user?.area, isOnline, alwaysConnect]);
}
