import { useEffect, useRef } from "react";
import { useOrders, Order } from "@/context/OrderContext";

const WS_RECONNECT_DELAY_MS = 3000;

function getWsUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  if (!domain) return "";
  return `wss://${domain}/api/ws`;
}

export function useOrderNotifications(isOnline: boolean = true) {
  const { injectNewOrder } = useOrders();
  const injectRef = useRef(injectNewOrder);
  injectRef.current = injectNewOrder;

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
}
