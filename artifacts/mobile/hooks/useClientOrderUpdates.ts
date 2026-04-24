import { useEffect, useRef } from "react";
import { useOrders, Order } from "@/context/OrderContext";
import { User } from "@/context/AppContext";

const WS_RECONNECT_DELAY_MS = 3000;

function getWsUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  if (!domain) return "";
  return `wss://${domain}/api/ws`;
}

export function useClientOrderUpdates(user: User | null = null, sessionToken: string | null = null) {
  const { updateOrder, bumpWsOrderStatusSignal } = useOrders();
  const updateOrderRef = useRef(updateOrder);
  const bumpSignalRef = useRef(bumpWsOrderStatusSignal);
  bumpSignalRef.current = bumpWsOrderStatusSignal;
  updateOrderRef.current = updateOrder;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const authRejectedRef = useRef(false);
  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;

  const isClient = user?.type === "client";

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
      if (!url || !sessionTokenRef.current) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        ws.send(
          JSON.stringify({
            type: "register",
            role: "client",
            token: sessionTokenRef.current,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);

          if (data.type === "auth_error") {
            console.warn("[Fanni] Client order updates WS auth rejected:", data.message);
            authRejectedRef.current = true;
            ws.close();
            return;
          }

          if (data.type === "order_status_update" && data.update && data.update.id) {
            const { id, ...fields } = data.update as { id: string } & Partial<Order>;
            updateOrderRef.current(id, fields);
            bumpSignalRef.current();
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current && !authRejectedRef.current) {
          console.warn("[Fanni] Client order updates WS closed. Reconnecting in", WS_RECONNECT_DELAY_MS, "ms...");
          reconnectTimerRef.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = (event) => {
        console.warn("[Fanni] Client order updates WS error:", event);
        ws.close();
      };
    }

    if (isClient && sessionToken) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [isClient, sessionToken]);
}
