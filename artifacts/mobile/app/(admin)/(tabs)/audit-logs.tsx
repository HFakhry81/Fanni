import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import { getApiBase } from "@/utils/api";

interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AdminAuditLogsScreen() {
  const colors = useColors();
  const { isRTL } = useApp();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/admin/audit-logs?limit=100`, {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });
      if (!res.ok) return;
      const json = await res.json() as { logs: AuditLog[] };
      setLogs(json.logs ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <AppHeader title={isRTL ? "سجل التدقيق" : "Audit log"} showHome showLogout />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === "web" ? 80 : 24 }}
          ListEmptyComponent={
            <Text style={{ color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }}>
              {isRTL ? "لا توجد قيود بعد." : "No audit entries yet."}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.action, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                {item.action}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                {item.targetType} · {item.targetId}
              </Text>
              {(item.previousStatus || item.newStatus) ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                  {item.previousStatus ?? "—"} → {item.newStatus ?? "—"}
                </Text>
              ) : null}
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>
                {new Date(item.createdAt).toLocaleString(isRTL ? "ar-EG" : "en-GB")}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  action: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 4 },
});
