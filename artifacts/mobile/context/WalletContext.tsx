import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/utils/api";

export type WalletSummary = {
  pointsBalance: number;
  promotionalBalance: number;
  purchasedBalance: number;
  pendingBonusPoints: number;
  updatedAt: string | null;
};

type WalletContextValue = {
  summary: WalletSummary | null;
  loading: boolean;
  refreshWallet: () => Promise<WalletSummary | null>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { sessionToken, user } = useAuth();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef<Promise<WalletSummary | null> | null>(null);

  const refreshWallet = useCallback(async (): Promise<WalletSummary | null> => {
    if (!sessionToken || user?.role !== "technician") {
      setSummary(null);
      return null;
    }
    if (inFlightRef.current) return inFlightRef.current;

    const apiBase = getApiBase();
    if (!apiBase) return null;

    const promise = (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/wallet/summary`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok) return null;
        const json = await res.json() as { summary: WalletSummary };
        const next = json.summary ?? null;
        setSummary(next);
        return next;
      } catch {
        return null;
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = promise;
    return promise;
  }, [sessionToken, user?.role]);

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshWallet();
    });
    return () => sub.remove();
  }, [refreshWallet]);

  const value = useMemo(
    () => ({ summary, loading, refreshWallet }),
    [summary, loading, refreshWallet],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}

/** Safe hook for components that may render outside WalletProvider. */
export function useWalletOptional(): WalletContextValue | null {
  return useContext(WalletContext);
}
