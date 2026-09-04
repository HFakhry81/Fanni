import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import { shouldShowDailyPrompt, markDailyPromptShown } from "@/utils/dailyPrompt";
import { useOrders, Order } from "@/context/OrderContext";
import { User } from "@/context/AppContext";
import { professionToCategory } from "@/utils/serviceCategories";
import { getWsUrl } from "@/utils/api";

const WS_RECONNECT_DELAY_MS = 3000;

const LOCATION_PROMPT_KEY = "fanni.tech.location_prompt";

async function getCurrentCoords(requestPermission: boolean): Promise<{ lat: number; lon: number } | null> {
  try {
    if (Platform.OS === "web") {
      return await new Promise((resolve) => {
        if (!navigator?.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 5000, maximumAge: 60_000 },
        );
      });
    }
    if (requestPermission) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;
    } else {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted") return null;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return null;
  }
}

async function getCoordsForWsRegister(): Promise<{ lat: number; lon: number } | null> {
  const mayPrompt = await shouldShowDailyPrompt(LOCATION_PROMPT_KEY);
  const coords = await getCurrentCoords(mayPrompt);
  if (mayPrompt) await markDailyPromptShown(LOCATION_PROMPT_KEY);
  if (coords) return coords;
  if (!mayPrompt) {
    const last = await Location.getLastKnownPositionAsync();
    if (last) return { lat: last.coords.latitude, lon: last.coords.longitude };
  }
  return null;
}

function buildRegisterMessage(
  user: User | null,
  sessionToken: string | null,
  isOnline: boolean,
  currentCoords?: { lat: number; lon: number } | null,
): string {
  const payload: Record<string, unknown> = { type: "register", isAvailable: isOnline };

  if (sessionToken) {
    payload.token = sessionToken;
  }

  // Routing uses profession (مهنة) + geography only — not specialty / multi-categories.
  if (user?.profession) {
    payload.profession = user.profession;
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

  if (currentCoords) {
    payload.currentLat = currentCoords.lat;
    payload.currentLon = currentCoords.lon;
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
  isWsConnected: boolean;
  refreshRoutingRegistration: () => void;
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
  const hasConnectedRef = useRef(false);

  const [isWsConnected, setIsWsConnected] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    authRejectedRef.current = false;
    hasConnectedRef.current = false;

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
        hasConnectedRef.current = true;
        if (mountedRef.current) setIsWsConnected(true);
        getCoordsForWsRegister().then((coords) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(buildRegisterMessage(userRef.current, sessionTokenRef.current, isOnlineRef.current, coords));
          }
        });
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
        } catch(_) { /* ignore */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current && hasConnectedRef.current) setIsWsConnected(false);
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

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        const ws = wsRef.current;
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          connect();
        }
      }
    });

    return () => {
      mountedRef.current = false;
      appStateSubscription.remove();
      disconnect();
    };
  }, [sessionToken]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    authRejectedRef.current = false;
    getCoordsForWsRegister().then((coords) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(buildRegisterMessage(user, sessionTokenRef.current, isOnline, coords));
      }
    });
    // Re-register on fields that affect routing — full `user` object identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [user?.id, user?.profession, user?.governorate, user?.area, isOnline]);

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

  const refreshRoutingRegistration = useCallback(() => {
    const ws = wsRef.current;
    const token = sessionTokenRef.current;
    if (ws?.readyState === WebSocket.OPEN && token) {
      ws.send(JSON.stringify({ type: "refresh_routing", token }));
    }
  }, []);

  const value: TechWsContextValue = {
    subscribeNewOrder,
    subscribeOrderCancelled,
    subscribeAvailabilityChanged,
    isWsConnected,
    refreshRoutingRegistration,
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