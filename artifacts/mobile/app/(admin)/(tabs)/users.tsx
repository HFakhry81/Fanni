import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

type UserTab = "technicians" | "clients" | "admins";

interface ApiUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  role: "client" | "technician" | "admin" | null;
  isActive: boolean;
  area: string | null;
  governorate: string | null;
  specialty: string | null;
  profession: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

const TAB_ROLE_MAP: Record<UserTab, string> = {
  technicians: "technician",
  clients: "client",
  admins: "admin",
};

export default function AdminUsersScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();

  const [tab, setTab] = useState<UserTab>("technicians");
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const currentPage = useRef(1);
  const isFetching = useRef(false);

  const fetchUsers = useCallback(async (page: number, replace: boolean) => {
    if (!sessionToken) return;
    if (isFetching.current) return;
    isFetching.current = true;

    if (replace) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const role = TAB_ROLE_MAP[tab];
      const apiBase = getApiBaseUrl();
      const res = await fetch(
        `${apiBase}/api/admin/users?page=${page}&limit=20&role=${role}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { users: ApiUser[]; pagination: Pagination };
      if (replace) {
        setUsers(data.users);
      } else {
        setUsers((prev) => [...prev, ...data.users]);
      }
      setPagination(data.pagination);
      currentPage.current = page;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      isFetching.current = false;
    }
  }, [sessionToken, tab]);

  useEffect(() => {
    currentPage.current = 1;
    fetchUsers(1, true);
  }, [fetchUsers]);

  const loadMore = useCallback(() => {
    if (!pagination) return;
    if (currentPage.current >= pagination.totalPages) return;
    fetchUsers(currentPage.current + 1, false);
  }, [pagination, fetchUsers]);

  const updateUser = useCallback(async (
    userId: string,
    updates: { role?: string; isActive?: boolean }
  ) => {
    if (!sessionToken) return;
    setUpdatingId(userId);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { user: { id: string; role: string; isActive: boolean } };
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                ...(data.user.role !== undefined ? { role: data.user.role as ApiUser["role"] } : {}),
                isActive: data.user.isActive,
              }
            : u
        )
      );
    } catch (err) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        err instanceof Error ? err.message : "Failed to update user"
      );
    } finally {
      setUpdatingId(null);
    }
  }, [sessionToken, isRTL]);

  const toggleStatus = useCallback((user: ApiUser) => {
    const action = user.isActive
      ? (isRTL ? "إيقاف" : "Suspend")
      : (isRTL ? "تفعيل" : "Activate");
    Alert.alert(
      action,
      isRTL
        ? `هل تريد ${user.isActive ? "إيقاف" : "تفعيل"} حساب ${user.firstName ?? ""}؟`
        : `${user.isActive ? "Suspend" : "Activate"} ${user.firstName ?? "this user"}'s account?`,
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: action,
          style: user.isActive ? "destructive" : "default",
          onPress: () => updateUser(user.id, { isActive: !user.isActive }),
        },
      ]
    );
  }, [isRTL, updateUser]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(isRTL ? "ar-EG" : "en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const displayName = (user: ApiUser) => {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : (user.mobile ?? user.email ?? "—");
  };

  const renderItem = ({ item }: { item: ApiUser }) => {
    const isActive = item.isActive;
    const name = displayName(item);
    const isUpdating = updatingId === item.id;

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        <View style={[styles.accentBar, { backgroundColor: isActive ? colors.success : colors.destructive }]} />
        <View style={styles.cardBody}>
          <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.avatar, {
              backgroundColor:
                item.role === "technician" ? colors.secondary :
                item.role === "admin" ? "#7C3AED" :
                colors.primary
            }]}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18 }}>
                {name[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
                {name}
              </Text>
              {item.mobile ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                  {item.mobile}
                </Text>
              ) : null}
              {item.email ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: isRTL ? "right" : "left" }} numberOfLines={1}>
                  {item.email}
                </Text>
              ) : null}
              {item.specialty ? (
                <Text style={{ color: colors.secondary, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                  {item.specialty}
                </Text>
              ) : null}
              <View style={[styles.roleBadge, { backgroundColor: item.role === "technician" ? "#EEF2FF" : item.role === "admin" ? "#F5F3FF" : "#EFF6FF" }]}>
                <Text style={{ color: item.role === "technician" ? colors.secondary : item.role === "admin" ? "#7C3AED" : colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 10 }}>
                  {item.role === "technician" ? (isRTL ? "فني" : "Technician") : item.role === "admin" ? (isRTL ? "مدير" : "Admin") : (isRTL ? "عميل" : "Client")}
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isActive ? "#D4EDDA" : "#FFE6E6", borderRadius: 8 }]}>
              <Text style={{ color: isActive ? colors.success : colors.destructive, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                {isActive ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Suspended")}
              </Text>
            </View>
          </View>

          <View style={[styles.metaRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Feather name="calendar" size={11} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginLeft: 4 }}>
              {formatDate(item.createdAt)}
            </Text>
            {(item.area || item.governorate) ? (
              <>
                <Text style={{ color: colors.border, marginHorizontal: 6 }}>·</Text>
                <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginLeft: 4 }}>
                  {[item.area, item.governorate].filter(Boolean).join(", ")}
                </Text>
              </>
            ) : null}
          </View>

          <View style={[styles.actionRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isActive ? "#FFE6E6" : "#D4EDDA", borderRadius: colors.radius - 4, opacity: isUpdating ? 0.5 : 1 }]}
              onPress={() => toggleStatus(item)}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={isActive ? colors.destructive : colors.success} />
              ) : (
                <>
                  <Feather name={isActive ? "slash" : "check"} size={14} color={isActive ? colors.destructive : colors.success} />
                  <Text style={{ color: isActive ? colors.destructive : colors.success, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                    {isActive ? t("admin.suspend") : t("admin.approve")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const tabs: [UserTab, string][] = [
    ["technicians", t("admin.technicians")],
    ["clients", t("admin.clients")],
    ["admins", isRTL ? "مديرون" : "Admins"],
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("admin.users")}
        subtitle={
          pagination
            ? `${pagination.total} ${isRTL ? "مستخدم" : "users"}`
            : isRTL ? "جارٍ التحميل..." : "Loading..."
        }
        showHome
        showLogout
      />

      <View style={[styles.tabBar, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {tabs.map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, { backgroundColor: tab === key ? colors.secondary : "transparent", borderRadius: colors.radius - 4 }]}
            onPress={() => setTab(key)}
          >
            <Feather
              name={key === "technicians" ? "tool" : key === "admins" ? "shield" : "users"}
              size={14}
              color={tab === key ? "#FFF" : colors.mutedForeground}
            />
            <Text style={{ color: tab === key ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 5 }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.secondary} />
          <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular" }}>
            {isRTL ? "جارٍ التحميل..." : "Loading users..."}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={{ color: colors.destructive, marginTop: 12, fontFamily: "Inter_500Medium", textAlign: "center" }}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.secondary, borderRadius: colors.radius - 4, marginTop: 16 }]}
            onPress={() => fetchUsers(1, true)}
          >
            <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold" }}>
              {isRTL ? "إعادة المحاولة" : "Retry"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular" }}>
                {isRTL ? "لا يوجد مستخدمون" : "No users found"}
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.secondary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { margin: 12, padding: 4, borderRadius: 14 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: { marginBottom: 12, borderWidth: 1.5, flexDirection: "row", overflow: "hidden" },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { alignItems: "center", marginBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10 },
  metaRow: { alignItems: "center", marginBottom: 10 },
  actionRow: { gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10 },
  roleBadge: { alignSelf: "flex-start", paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6, marginTop: 3 },
});
