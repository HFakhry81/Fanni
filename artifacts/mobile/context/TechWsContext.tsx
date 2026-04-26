import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
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

function buildRegisterMessage(user: User | null, sessionToken: string | null, isOnline: boolean): string {
  const payload: Record<string, unknown> = { type: "register", isAvailable: isOnline };

  if (sessionToken) {
    payload.token = sessionToken;
  }

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

  return JSON.stringify(payload);
}

type NewOrderSubscriber = () => void;
type OrderCancelledSubscriber = (orderId: string) => void;
type AvailabilitySubscriber = (isAvailable: boolean) => void;

interface TechWsContextValue {
  subscribeNewOrder: (cb: NewOrderSubscriber) => () => void;
  subscribeOrderCancelled: (cb: OrderCancelledSubscriber) => () => void;
  subscribeAvailabilityChanged: (cb: AvailabilitySubscriber) => () => void;
}

const TechWsContext = createContext<TechWsContextValue | null>(null);

interface TechWsProviderProps {
  user: User | null;
  sessionToken: string | null;
  isOnline: boolean;
  children: React.ReactNode;
}

export function TechWsProvider({ user, sessionToken, isOnline, children }: TechWsProviderProps) {
  const { injectNewOrder, removePendingOrder, bumpWsOrderStatusSignal, updateOrder } = useOrders();

  const injectRef = useRef(injectNewOrder);
  const removeRef = useRef(removePendingOrder);
  const bumpSignalRef = useRef(bumpWsOrderStatusSignal);
  const updateOrderRef = useRef(updateOrder);
  injectRef.current = injectNewOrder;
  removeRef.current = removePendingOrder;
  bumpSignalRef.current = bumpWsOrderStatusSignal;
  updateOrderRef.current = updateOrder;

  const userRef = useRef(user);
  userRef.current = user;
  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const newOrderSubs = useRef<Set<NewOrderSubscriber>>(new Set());
  const orderCancelledSubs = useRef<Set<OrderCancelledSubscriber>>(new Set());
  const availabilitySubs = useRef<Set<AvailabilitySubscriber>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const authRejectedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    authRejectedRef.current = false;

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
        ws.send(buildRegisterMessage(userRef.current, sessionTokenRef.current, isOnlineRef.current));
      };

      ws.onmessage = (event) => {
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
            newOrderSubs.current.forEach((cb) => cb());
          }

          if (data.type === "order_cancelled" && data.orderId) {
            const oid = data.orderId as string;
            removeRef.current(oid);
            orderCancelledSubs.current.forEach((cb) => cb(oid));
          }

          if (data.type === "order_status_update" && data.update && data.update.id) {
            const { id, ...fields } = data.update as { id: string } & Partial<Order>;
            updateOrderRef.current(id, fields);
            bumpSignalRef.current();
          }

          if (data.type === "availability_changed_by_admin" && typeof data.isAvailable === "boolean") {
            availabilitySubs.current.forEach((cb) => cb(data.isAvailable as boolean));
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current && !authRejectedRef.current) {
          console.warn("[Fanni] Shared tech WS closed. Reconnecting in", WS_RECONNECT_DELAY_MS, "ms...");
          reconnectTimerRef.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = (event) => {
        console.warn("[Fanni] Shared tech WS error:", event);
        ws.close();
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [sessionToken]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    authRejectedRef.current = false;
    ws.send(buildRegisterMessage(user, sessionTokenRef.current, isOnline));
  }, [user?.id, user?.profession, user?.serviceCategories, user?.governorate, user?.area, isOnline]);

  const subscribeNewOrder = useCallback((cb: NewOrderSubscriber) => {
    newOrderSubs.current.add(cb);
    return () => { newOrderSubs.current.delete(cb); };
  }, []);

  const subscribeOrderCancelled = useCallback((cb: OrderCancelledSubscriber) => {
    orderCancelledSubs.current.add(cb);
    return () => { orderCancelledSubs.current.delete(cb); };
  }, []);

  const subscribeAvailabilityChanged = useCallback((cb: AvailabilitySubscriber) => {
    availabilitySubs.current.add(cb);
    return () => { availabilitySubs.current.delete(cb); };
  }, []);

  const value: TechWsContextValue = {
    subscribeNewOrder,
    subscribeOrderCancelled,
    subscribeAvailabilityChanged,
  };

  return <TechWsContext.Provider value={value}>{children}</TechWsContext.Provider>;
}

export function useTechWs(): TechWsContextValue {
  const ctx = useContext(TechWsContext);
  if (!ctx) {
    throw new Error("useTechWs must be used within a TechWsProvider");
  }
  return ctx;
}
