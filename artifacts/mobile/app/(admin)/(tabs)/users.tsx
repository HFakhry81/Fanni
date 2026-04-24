import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import VectorIcon from "@/components/VectorIcon";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPage = useRef(1);
  const replaceAbortController = useRef<AbortController | null>(null);
  const isLoadingMoreRef = useRef(false);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 400);
  }, []);

  const fetchUsers = useCallback(async (page: number, replace: boolean, search?: string) => {
    if (!sessionToken) return;

    if (replace) {
      // Cancel any in-flight replacement request so the latest query always wins
      replaceAbortController.current?.abort();
      const controller = new AbortController();
      replaceAbortController.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const role = TAB_ROLE_MAP[tab];
        const apiBase = getApiBaseUrl();
        const searchParam = search && search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
        const res = await fetch(
          `${apiBase}/api/admin/users?page=${page}&limit=20&role=${role}${searchParam}`,
          { headers: { Authorization: `Bearer ${sessionToken}` }, signal: controller.signal }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        const data = await res.json() as { users: ApiUser[]; pagination: Pagination };
        setUsers(data.users);
        setPagination(data.pagination);
        currentPage.current = page;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setIsLoading(false);
      }
    } else {
      // Load-more: guard against concurrent requests
      if (isLoadingMoreRef.current) return;
      isLoadingMoreRef.current = true;
      setIsLoadingMore(true);

      try {
        const role = TAB_ROLE_MAP[tab];
        const apiBase = getApiBaseUrl();
        const searchParam = search && search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
        const res = await fetch(
          `${apiBase}/api/admin/users?page=${page}&limit=20&role=${role}${searchParam}`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        const data = await res.json() as { users: ApiUser[]; pagination: Pagination };
        setUsers((prev) => [...prev, ...data.users]);
        setPagination(data.pagination);
        currentPage.current = page;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setIsLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    }
  }, [sessionToken, tab]);

  useEffect(() => {
    currentPage.current = 1;
    fetchUsers(1, true, debouncedSearch);
  }, [fetchUsers, debouncedSearch]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      replaceAbortController.current?.abort();
    };
  }, []);

  const loadMore = useCallback(() => {
    if (!pagination) return;
    if (currentPage.current >= pagination.totalPages) return;
    fetchUsers(currentPage.current + 1, false, debouncedSearch);
  }, [pagination, fetchUsers, debouncedSearch]);

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
            <VectorIcon name="calendar" size={11} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginLeft: 4 }}>
              {formatDate(item.createdAt)}
            </Text>
            {(item.area || item.governorate) ? (
              <>
                <Text style={{ color: colors.border, marginHorizontal: 6 }}>·</Text>
                <VectorIcon name="map-pin" size={11} color={colors.mutedForeground} />
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
                  <VectorIcon name={isActive ? "slash" : "check"} size={14} color={isActive ? colors.destructive : colors.success} />
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
            onPress={() => {
              if (tab !== key) {
                if (debounceTimer.current) clearTimeout(debounceTimer.current);
                setSearchQuery("");
                setDebouncedSearch("");
                setTab(key);
              }
            }}
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

      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <VectorIcon name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
          placeholder={isRTL ? "بحث بالاسم أو الجوال أو البريد أو المنطقة..." : "Search by name, mobile, email, or area..."}
          placeholderTextColor={colors.mutedForeground}
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && Platform.OS !== "ios" ? (
          <TouchableOpacity onPress={() => handleSearchChange("")}>
            <VectorIcon name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
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
          <VectorIcon name="alert-circle" size={40} color={colors.destructive} />
          <Text style={{ color: colors.destructive, marginTop: 12, fontFamily: "Inter_500Medium", textAlign: "center" }}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.secondary, borderRadius: colors.radius - 4, marginTop: 16 }]}
            onPress={() => fetchUsers(1, true, debouncedSearch)}
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
              <VectorIcon name={debouncedSearch ? "search" : "users"} size={40} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular", textAlign: "center" }}>
                {debouncedSearch
                  ? (isRTL ? `لا توجد نتائج لـ "${debouncedSearch}"` : `No results for "${debouncedSearch}"`)
                  : (isRTL ? "لا يوجد مستخدمون" : "No users found")}
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
  tabBar: { margin: 12, marginBottom: 0, padding: 4, borderRadius: 14 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 0,
  },
  list: { paddingHorizontal: 16, paddingTop: 8 },
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
