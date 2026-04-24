import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

interface LoginLog {
  id: number;
  userId: string | null;
  identifier: string;
  role: string | null;
  success: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type FilterRole = "all" | "client" | "technician" | "admin";
type FilterSuccess = "all" | "true" | "false";

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

function formatDateTime(iso: string, isRTL: boolean): string {
  const d = new Date(iso);
  return d.toLocaleString(isRTL ? "ar-EG" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: string | null, t: (k: string) => string): string {
  if (!role) return "—";
  if (role === "admin") return t("role.admin");
  if (role === "technician") return t("role.technician");
  if (role === "client") return t("role.client");
  return role;
}

function failureLabel(reason: string | null, t: (k: string) => string): string {
  if (!reason) return "";
  const map: Record<string, string> = {
    invalid_password: t("loginLogs.failureInvalidPassword"),
    user_not_found: t("loginLogs.failureNotFound"),
    account_suspended: t("loginLogs.failureSuspended"),
  };
  return map[reason] ?? reason;
}

function roleColor(role: string | null, colors: ReturnType<typeof useColors>): string {
  if (role === "admin") return "#9333ea";
  if (role === "technician") return colors.accent;
  if (role === "client") return colors.primary;
  return colors.mutedForeground;
}

export default function LoginLogsScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();

  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterRole, setFilterRole] = useState<FilterRole>("all");
  const [filterSuccess, setFilterSuccess] = useState<FilterSuccess>("all");

  const fetchLogs = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (!sessionToken) return;
      if (replace) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams({ page: String(pageNum), limit: "30" });
      if (filterRole !== "all") params.append("role", filterRole);
      if (filterSuccess !== "all") params.append("success", filterSuccess);

      try {
        const res = await fetch(`${getApiBaseUrl()}/api/admin/login-logs?${params}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setLogs((prev) => (replace ? data.logs : [...prev, ...data.logs]));
        setPagination(data.pagination);
      } catch {
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [sessionToken, filterRole, filterSuccess],
  );

  useEffect(() => {
    setPage(1);
    setLogs([]);
    fetchLogs(1, true);
  }, [filterRole, filterSuccess, fetchLogs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setLogs([]);
    fetchLogs(1, true);
  }, [fetchLogs]);

  const onEndReached = useCallback(() => {
    if (!pagination) return;
    if (page >= pagination.totalPages) return;
    if (loadingMore) return;
    const next = page + 1;
    setPage(next);
    fetchLogs(next, false);
  }, [pagination, page, loadingMore, fetchLogs]);

  const roleTabs: { key: FilterRole; label: string }[] = [
    { key: "all", label: t("common.all") },
    { key: "admin", label: t("role.admin") },
    { key: "technician", label: t("role.technician") },
    { key: "client", label: t("role.client") },
  ];

  const successTabs: { key: FilterSuccess; label: string }[] = [
    { key: "all", label: t("common.all") },
    { key: "true", label: t("loginLogs.success") },
    { key: "false", label: t("loginLogs.failed") },
  ];

  const renderLog = ({ item }: { item: LoginLog }) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: item.success ? "#22c55e" : colors.destructive,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: item.success ? "#22c55e" : colors.destructive }]} />
      <View style={{ flex: 1 }}>
        <View style={[styles.cardRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: roleColor(item.role, colors) + "22" },
            ]}
          >
            <Text style={[styles.roleText, { color: roleColor(item.role, colors) }]}>
              {roleLabel(item.role, t)}
            </Text>
          </View>
          <Text style={[styles.identifier, { color: colors.foreground }]} numberOfLines={1}>
            {item.identifier}
          </Text>
        </View>

        <View style={[styles.cardRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            {formatDateTime(item.createdAt, isRTL)}
          </Text>
          {item.ipAddress ? (
            <Text style={[styles.ipText, { color: colors.mutedForeground }]}>
              {item.ipAddress}
            </Text>
          ) : null}
        </View>

        {!item.success && item.failureReason ? (
          <Text style={[styles.failureText, { color: colors.destructive, textAlign: isRTL ? "right" : "left" }]}>
            {failureLabel(item.failureReason, t)}
          </Text>
        ) : null}
      </View>

      <VectorIcon
        name={item.success ? "check-circle" : "x-circle"}
        size={20}
        color={item.success ? "#22c55e" : colors.destructive}
        style={{ alignSelf: "center", marginStart: 8 }}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("loginLogs.title")} />

      <View style={[styles.filtersSection, { borderBottomColor: colors.border }]}>
        <Text style={[styles.filterLabel, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
          {t("loginLogs.filterRole")}
        </Text>
        <View style={[styles.filterRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {roleTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filterRole === tab.key ? colors.primary : colors.card,
                  borderColor: filterRole === tab.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilterRole(tab.key)}
            >
              <Text style={[styles.filterChipText, { color: filterRole === tab.key ? "#fff" : colors.foreground }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.filterLabel, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left", marginTop: 6 }]}>
          {t("loginLogs.filterStatus")}
        </Text>
        <View style={[styles.filterRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {successTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filterSuccess === tab.key ? colors.primary : colors.card,
                  borderColor: filterSuccess === tab.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilterSuccess(tab.key)}
            >
              <Text style={[styles.filterChipText, { color: filterSuccess === tab.key ? "#fff" : colors.foreground }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {pagination && (
          <Text style={[styles.totalText, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
            {t("loginLogs.totalEntries").replace("{n}", String(pagination.total))}
          </Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLog}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} color={colors.primary} /> : null
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {t("loginLogs.empty")}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filtersSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  filterRow: { flexWrap: "wrap", gap: 6, marginBottom: 2 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: "500" },
  totalText: { fontSize: 12, marginTop: 6 },
  listContent: { padding: 12, gap: 10 },
  card: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    alignItems: "flex-start",
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginEnd: 10,
    marginTop: 6,
  },
  cardRow: { alignItems: "center", gap: 8, flexWrap: "wrap" },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: { fontSize: 11, fontWeight: "700" },
  identifier: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  dateText: { fontSize: 11 },
  ipText: { fontSize: 11, fontStyle: "italic" },
  failureText: { fontSize: 12, marginTop: 2 },
  emptyText: { textAlign: "center", marginTop: 60, fontSize: 15 },
});
