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
  ScrollView,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon, { type IconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import { getApiBase } from "@/utils/api";
import TechBonusGrantsPanel from "@/components/admin/TechBonusGrantsPanel";
import { confirmDialog } from "@/utils/confirmDialog";

// ─── Types ─────────────────────────────────────────────────────────────────────
type MainView = "hub" | "clients" | "technicians" | "collection";
type TechSubView = "hub" | "list";
type CollSubView = "hub" | "received" | "refunded" | "tech_balances" | "commission";
type StatusFilter = "all" | "active" | "suspended" | "pending";

interface ApiUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  email: string | null;
  role: "client" | "technician" | null;
  isActive: boolean;
  isAvailable: boolean | null;
  area: string | null;
  governorate: string | null;
  specialty: string | null;
  profession: string | null;
  approvalStatus?: string | null;
  createdAt: string;
  toggleCount24h?: number | null;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  suspendedByAdminId?: string | null;
  suspendedByAdminName?: string | null;
}

interface LedgerEntry {
  id: string;
  orderNumber: string | null;
  technicianName: string | null;
  clientName: string | null;
  labourFee: number | null;
  serviceFeeAmount: number | null;
  vatAmount: number | null;
  netTotal: number | null;
  status: string;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function userName(u: ApiUser): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return name || u.mobile || "—";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

// ─── Hub Card ───────────────────────────────────────────────────────────────────
interface HubCardProps {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  badge?: string | number;
  badgeColor?: string;
  onPress: () => void;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
}

function HubCard({
  icon, iconColor, iconBg, title, subtitle, badge, badgeColor,
  onPress, isRTL, colors,
}: HubCardProps) {
  return (
    <TouchableOpacity
      style={[styles.hubCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.hubCardInner, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.hubIcon, { backgroundColor: iconBg }]}>
          <VectorIcon name={icon} size={26} color={iconColor} />
        </View>
        <View style={[styles.hubCardText, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 8 }}>
            <Text style={[styles.hubCardTitle, { color: colors.foreground }]}>{title}</Text>
            {badge !== undefined && (
              <View style={[styles.hubBadge, { backgroundColor: badgeColor ?? colors.primary }]}>
                <Text style={styles.hubBadgeText}>{badge}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.hubCardSub, { color: colors.mutedForeground }]}>{subtitle}</Text>
        </View>
        <VectorIcon
          name={isRTL ? "chevron-left" : "chevron-right"}
          size={18}
          color={colors.mutedForeground}
          style={{ marginLeft: isRTL ? 0 : "auto", marginRight: isRTL ? "auto" : 0 }}
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Sub-nav bar ─────────────────────────────────────────────────────────────────
function SubHeader({
  title, subtitle, onBack, isRTL, colors,
}: {
  title: string; subtitle?: string; onBack: () => void;
  isRTL: boolean; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.subHeader,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
      ]}
    >
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
        <VectorIcon name={isRTL ? "arrow-right" : "arrow-left"} size={20} color={colors.primary} />
      </TouchableOpacity>
      <View style={[styles.subHeaderText, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        <Text style={[styles.subHeaderTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subHeaderSub, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Status chip ─────────────────────────────────────────────────────────────────
function FilterChip({
  label, active, onPress, colors,
}: {
  label: string; active: boolean; onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.muted,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── User list item ───────────────────────────────────────────────────────────────
function UserRow({
  user, onToggle, updating, isTech, isRTL, colors, t,
}: {
  user: ApiUser;
  onToggle: (u: ApiUser) => void;
  updating: boolean;
  isTech: boolean;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: (k: string) => string;
}) {
  const PRIMARY = "#F5A623";
  const isActive = user.isActive;

  return (
    <View
      style={[
        styles.userRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
      ]}
    >
      <View
        style={[
          styles.userAvatar,
          { backgroundColor: isTech ? "#FFF3E0" : "#E3F2FD" },
        ]}
      >
        <VectorIcon
          name={isTech ? "tool" : "user"}
          size={20}
          color={isTech ? PRIMARY : "#4DADD9"}
        />
      </View>
      <View style={[styles.userInfo, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        <Text
          style={[styles.userName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {userName(user)}
        </Text>
        <Text
          style={[styles.userSub, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {user.mobile ?? "—"}
          {(user.specialty || user.profession) ? ` · ${user.specialty ?? user.profession}` : ""}
        </Text>
        {(user.governorate || user.area) ? (
          <Text
            style={[styles.userMeta, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            <VectorIcon name="map-pin" size={11} color={colors.mutedForeground} />
            {" "}{[user.governorate, user.area].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {isTech && user.approvalStatus === "pending_review" ? (
          <Text style={[styles.userMeta, { color: "#7C5CBF", marginTop: 2 }]}>
            {isRTL ? "بانتظار الموافقة" : "Pending approval"}
          </Text>
        ) : null}
        {!isActive && user.suspensionReason ? (
          <Text style={[styles.userMeta, { color: "#E74C3C", marginTop: 4 }]} numberOfLines={2}>
            {isRTL ? "سبب الإيقاف: " : "Reason: "}{user.suspensionReason}
          </Text>
        ) : null}
        {!isActive && (user.suspendedByAdminName || user.suspendedAt) ? (
          <Text style={[styles.userMeta, { color: colors.mutedForeground, marginTop: 2 }]} numberOfLines={1}>
            {user.suspendedByAdminName
              ? (isRTL ? `بواسطة ${user.suspendedByAdminName}` : `By ${user.suspendedByAdminName}`)
              : ""}
            {user.suspendedAt
              ? `${user.suspendedByAdminName ? " · " : ""}${formatDate(user.suspendedAt)}`
              : ""}
          </Text>
        ) : null}
      </View>
      <View style={styles.userActions}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isActive ? "#22A36B" : "#E74C3C" },
          ]}
        />
        <TouchableOpacity
          onPress={() => onToggle(user)}
          disabled={updating}
          activeOpacity={0.8}
          style={[
            styles.actionBtn,
            {
              backgroundColor: isActive ? "#FFF3E0" : "#E8F8F0",
              borderColor: isActive ? "#F5A623" : "#22A36B",
            },
          ]}
        >
          {updating ? (
            <ActivityIndicator size="small" color={isActive ? PRIMARY : "#22A36B"} />
          ) : (
            <Text
              style={[
                styles.actionBtnText,
                { color: isActive ? PRIMARY : "#22A36B" },
              ]}
            >
              {isActive ? t("admin.suspend") : t("admin.approve")}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Suspend user modal ─────────────────────────────────────────────────────────
function SuspendUserModal({
  visible,
  user,
  reason,
  onChangeReason,
  onClose,
  onConfirm,
  submitting,
  isRTL,
  colors,
}: {
  visible: boolean;
  user: ApiUser | null;
  reason: string;
  onChangeReason: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  if (!user) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "تعليق الحساب" : "Suspend account"}
          </Text>
          <Text style={[styles.modalSub, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
            {isRTL
              ? `أدخل سبب إيقاف حساب ${userName(user)}. سيظهر هذا السبب للمستخدم عند محاولة الدخول.`
              : `Enter a reason to suspend ${userName(user)}. The user will see this when signing in.`}
          </Text>
          <TextInput
            value={reason}
            onChangeText={onChangeReason}
            placeholder={isRTL ? "سبب الإيقاف..." : "Suspension reason..."}
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            style={[
              styles.modalInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
                textAlign: isRTL ? "right" : "left",
              },
            ]}
          />
          <View style={[styles.modalActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <TouchableOpacity
              style={[styles.modalBtn, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={{ color: colors.foreground }}>{isRTL ? "إلغاء" : "Cancel"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#E74C3C", borderColor: "#E74C3C" }]}
              onPress={onConfirm}
              disabled={submitting || !reason.trim()}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>
                  {isRTL ? "تأكيد التعليق" : "Confirm suspend"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Users list view (clients or technicians) ─────────────────────────────────────
function UserListView({
  role, isRTL, colors, t, sessionToken,
}: {
  role: "client" | "technician";
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: (k: string) => string;
  sessionToken: string | null;
}) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<ApiUser | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(
    async (refresh = false) => {
      if (!sessionToken) return;
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const base = getApiBase();
        if (!base) {
          setError(isRTL ? "عنوان الخادم غير متاح" : "API base URL unavailable");
          setUsers([]);
          return;
        }
        const params = new URLSearchParams({
          role,
          limit: "50",
          ...(filter === "pending"
            ? { isApproved: "false" }
            : filter !== "all"
              ? { isActive: filter === "active" ? "true" : "false" }
              : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        });
        const res = await fetch(`${base}/api/admin/users?${params}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok) {
          setUsers([]);
          setError(isRTL ? "تعذّر تحميل القائمة" : "Could not load users");
          return;
        }
        const data = await res.json() as { users: ApiUser[] };
        setUsers(data.users ?? []);
      } catch {
        setUsers([]);
        setError(isRTL ? "خطأ في الاتصال" : "Connection error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sessionToken, role, filter, debouncedSearch, isRTL]
  );

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
  }, [search]);

  const patchUserStatus = useCallback(
    async (user: ApiUser, nextActive: boolean, reason?: string) => {
      if (!sessionToken) return false;
      setUpdatingId(user.id);
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/api/admin/users/${user.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: nextActive,
            ...(nextActive ? {} : { suspensionReason: reason?.trim() }),
          }),
        });
        if (!res.ok) return false;
        const data = await res.json() as {
          user: {
            isActive: boolean;
            suspensionReason?: string | null;
            suspendedAt?: string | null;
            suspendedByAdminId?: string | null;
          };
        };
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? {
                  ...u,
                  isActive: data.user.isActive,
                  suspensionReason: data.user.suspensionReason ?? null,
                  suspendedAt: data.user.suspendedAt ?? null,
                  suspendedByAdminId: data.user.suspendedByAdminId ?? null,
                }
              : u
          )
        );
        return true;
      } catch {
        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    [sessionToken]
  );

  const handleTogglePress = useCallback(
    (user: ApiUser) => {
      if (user.isActive) {
        setSuspendReason("");
        setSuspendTarget(user);
        return;
      }
      confirmDialog(
        isRTL ? "تفعيل الحساب؟" : "Reactivate account?",
        isRTL
          ? `هل تريد إعادة تفعيل حساب ${userName(user)}؟`
          : `Reactivate ${userName(user)}'s account?`,
        [
          { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
          {
            text: isRTL ? "تأكيد" : "Confirm",
            onPress: async () => {
              const ok = await patchUserStatus(user, true);
              if (!ok) {
                Alert.alert(
                  isRTL ? "فشل التفعيل" : "Reactivation failed",
                  isRTL ? "تعذّر تفعيل الحساب" : "Could not reactivate account"
                );
              }
            },
          },
        ]
      );
    },
    [isRTL, patchUserStatus]
  );

  const confirmSuspend = useCallback(async () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    const ok = await patchUserStatus(suspendTarget, false, suspendReason);
    if (ok) {
      setSuspendTarget(null);
      setSuspendReason("");
      await fetchUsers(true);
    } else {
      Alert.alert(
        isRTL ? "فشل التعليق" : "Suspend failed",
        isRTL ? "تعذّر تعليق الحساب" : "Could not suspend account"
      );
    }
  }, [suspendTarget, suspendReason, patchUserStatus, fetchUsers, isRTL]);

  const filters: { label: string; value: StatusFilter }[] = [
    { label: isRTL ? "الكل" : "All", value: "all" },
    { label: isRTL ? "نشط" : "Active", value: "active" },
    { label: isRTL ? "موقوف" : "Suspended", value: "suspended" },
    ...(role === "technician"
      ? [{ label: isRTL ? "بانتظار الموافقة" : "Pending", value: "pending" as const }]
      : []),
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SuspendUserModal
        visible={!!suspendTarget}
        user={suspendTarget}
        reason={suspendReason}
        onChangeReason={setSuspendReason}
        onClose={() => {
          if (updatingId) return;
          setSuspendTarget(null);
          setSuspendReason("");
        }}
        onConfirm={() => { void confirmSuspend(); }}
        submitting={!!suspendTarget && updatingId === suspendTarget.id}
        isRTL={isRTL}
        colors={colors}
      />
      <View
        style={[
          styles.searchRow,
          {
            backgroundColor: colors.background,
            flexDirection: isRTL ? "row-reverse" : "row",
          },
        ]}
      >
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              flexDirection: isRTL ? "row-reverse" : "row",
            },
          ]}
        >
          <VectorIcon name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("common.search")}
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.searchInput,
              { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
            ]}
          />
        </View>
      </View>
      <View
        style={[
          styles.chipRow,
          {
            backgroundColor: colors.background,
            flexDirection: isRTL ? "row-reverse" : "row",
          },
        ]}
      >
        {filters.map((f) => (
          <FilterChip
            key={f.value}
            label={f.label}
            active={filter === f.value}
            onPress={() => setFilter(f.value)}
            colors={colors}
          />
        ))}
      </View>
      {error ? (
        <TouchableOpacity
          style={[styles.center, { paddingVertical: 24 }]}
          onPress={() => fetchUsers()}
          activeOpacity={0.7}
        >
          <Text style={[styles.emptyText, { color: "#DC2626" }]}>{error}</Text>
          <Text style={{ color: colors.primary, marginTop: 8, fontFamily: "Inter_500Medium" }}>
            {isRTL ? "إعادة المحاولة" : "Retry"}
          </Text>
        </TouchableOpacity>
      ) : null}
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            onToggle={handleTogglePress}
            updating={updatingId === item.id}
            isTech={role === "technician"}
            isRTL={isRTL}
            colors={colors}
            t={t}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchUsers(true)} />
        }
        ListEmptyComponent={
          error ? null : (
            <View style={styles.center}>
              <VectorIcon name="users" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {t("common.noData")}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

// ─── Tech sub-hub cards ────────────────────────────────────────────────────────
function TechHubView({
  isRTL, colors, t, onShowList, router, sessionToken,
}: {
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: (k: string) => string;
  onShowList: () => void;
  router: ReturnType<typeof useRouter>;
  sessionToken: string | null;
}) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [techCount, setTechCount] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    (async () => {
      try {
        const base = getApiBase();
        if (!base) return;
        const res = await fetch(`${base}/api/admin/users/counts?role=technician`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json() as { all?: number; pending?: number };
        if (!cancelled) {
          setTechCount(data.all ?? 0);
          setPendingCount(data.pending ?? 0);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [sessionToken]);

  const items: {
    icon: IconName; iconColor: string; iconBg: string;
    title: string; subtitle: string; onPress: () => void;
    badge?: string | number; badgeColor?: string;
  }[] = [
    {
      icon: "tool",
      iconColor: "#F5A623",
      iconBg: "#FFF3E0",
      title: t("admin.tech.list"),
      subtitle: t("admin.tech.listDesc"),
      onPress: onShowList,
      badge: techCount ?? undefined,
      badgeColor: "#F5A623",
    },
    {
      icon: "map",
      iconColor: "#4DADD9",
      iconBg: "#E3F2FD",
      title: t("admin.tech.liveMap"),
      subtitle: t("admin.tech.liveMapDesc"),
      onPress: () => router.push({ pathname: "/(admin)/(tabs)/map-dashboard", params: { mode: "tech" } }),
    },
    {
      icon: "alert-triangle",
      iconColor: "#E67E22",
      iconBg: "#FFF3E0",
      title: t("admin.tech.missedAddresses"),
      subtitle: t("admin.tech.missedAddressesDesc"),
      onPress: () => router.push("/(admin)/(tabs)/missed-locations"),
    },
    {
      icon: "clock",
      iconColor: "#7C5CBF",
      iconBg: "#EDE9FE",
      title: t("admin.tech.pendingApproval"),
      subtitle: t("admin.tech.pendingApprovalDesc"),
      onPress: () => router.push("/(admin)/(tabs)/pending"),
      badge: pendingCount ?? undefined,
      badgeColor: "#7C5CBF",
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.subHubContent}>
      {items.map((item) => (
        <HubCard
          key={item.title}
          icon={item.icon}
          iconColor={item.iconColor}
          iconBg={item.iconBg}
          title={item.title}
          subtitle={item.subtitle}
          badge={item.badge}
          badgeColor={item.badgeColor}
          onPress={item.onPress}
          isRTL={isRTL}
          colors={colors}
        />
      ))}
    </ScrollView>
  );
}

// ─── Collection & Recovery ──────────────────────────────────────────────────────
function CollectionEntry({
  label, value, sub, isRTL, colors,
}: {
  label: string; value: string; sub?: string;
  isRTL: boolean; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.collRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
      ]}
    >
      <View style={{ flex: 1, alignItems: isRTL ? "flex-end" : "flex-start" }}>
        <Text style={[styles.collLabel, { color: colors.foreground }]}>{label}</Text>
        {sub ? <Text style={[styles.collSub, { color: colors.mutedForeground }]}>{sub}</Text> : null}
      </View>
      <Text style={[styles.collValue, { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

function ReceivedView({
  sessionToken, isRTL, colors, t,
}: {
  sessionToken: string | null; isRTL: boolean;
  colors: ReturnType<typeof useColors>; t: (k: string) => string;
}) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    (async () => {
      try {
        const base = getApiBase();
        const today = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
        const res = await fetch(
          `${base}/api/admin/ledger?dateFrom=${from}&dateTo=${today}&limit=50`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        if (res.ok) {
          const data = await res.json() as { entries: LedgerEntry[] };
          setEntries(data.entries ?? []);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [sessionToken]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const total = entries.reduce((s, e) => s + (e.netTotal ?? 0), 0);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
      <View style={[styles.summaryCard, { backgroundColor: "#E8F8F0", borderColor: "#22A36B" }]}>
        <Text style={[styles.summaryLabel, { color: "#22A36B" }]}>
          {isRTL ? "إجمالي المستلم (30 يوم)" : "Total Received (30 days)"}
        </Text>
        <Text style={[styles.summaryValue, { color: "#22A36B" }]}>
          {fmt(total)} {t("common.egpShort")}
        </Text>
      </View>
      {entries.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground }}>{t("common.noData")}</Text>
        </View>
      ) : (
        entries.map((e) => (
          <CollectionEntry
            key={e.id}
            label={e.clientName ?? "—"}
            value={`${fmt(e.netTotal)} ${t("common.egpShort")}`}
            sub={`${isRTL ? "طلب" : "Order"} ${e.orderNumber ?? "—"} · ${formatDate(e.createdAt)}`}
            isRTL={isRTL}
            colors={colors}
          />
        ))
      )}
    </ScrollView>
  );
}

function RefundedView({
  isRTL, colors, t,
}: {
  isRTL: boolean; colors: ReturnType<typeof useColors>; t: (k: string) => string;
}) {
  return (
    <View style={[styles.center, { padding: 32 }]}>
      <View style={[styles.comingSoonIcon, { backgroundColor: "#FFF3E0" }]}>
        <VectorIcon name="refresh-cw" size={36} color="#F5A623" />
      </View>
      <Text style={[styles.comingSoonTitle, { color: colors.foreground }]}>
        {t("common.comingSoon")}
      </Text>
      <Text style={[styles.comingSoonDesc, { color: colors.mutedForeground, textAlign: "center" }]}>
        {t("common.comingSoonDesc")}
      </Text>
      <View style={[styles.featureTag, { backgroundColor: colors.muted }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
          {isRTL ? "يتطلب تفعيل بوابة المدفوعات" : "Requires payment gateway setup"}
        </Text>
      </View>
    </View>
  );
}

function CommissionView({
  sessionToken, isRTL, colors, t,
}: {
  sessionToken: string | null; isRTL: boolean;
  colors: ReturnType<typeof useColors>; t: (k: string) => string;
}) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    (async () => {
      try {
        const base = getApiBase();
        const today = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
        const res = await fetch(
          `${base}/api/admin/ledger?dateFrom=${from}&dateTo=${today}&limit=100`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        if (res.ok) {
          const data = await res.json() as { entries: LedgerEntry[] };
          setEntries(data.entries ?? []);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [sessionToken]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const totalCommission = entries.reduce((s, e) => s + (e.serviceFeeAmount ?? 0), 0);
  const totalVAT = entries.reduce((s, e) => s + (e.vatAmount ?? 0), 0);
  const totalLabour = entries.reduce((s, e) => s + (e.labourFee ?? 0), 0);

  const summaries = [
    {
      label: isRTL ? "عمولة الخدمة" : "Service Commission",
      value: `${fmt(totalCommission)} ${t("common.egpShort")}`,
      color: "#22A36B", bg: "#E8F8F0",
    },
    {
      label: isRTL ? "ضريبة القيمة المضافة" : "VAT Collected",
      value: `${fmt(totalVAT)} ${t("common.egpShort")}`,
      color: "#7C5CBF", bg: "#EDE9FE",
    },
    {
      label: isRTL ? "أجر الخدمة والمصنعية" : "Labour Revenue",
      value: `${fmt(totalLabour)} ${t("common.egpShort")}`,
      color: "#4DADD9", bg: "#E3F2FD",
    },
    {
      label: isRTL ? "إجمالي الإيرادات" : "Total Revenue",
      value: `${fmt(totalCommission + totalVAT + totalLabour)} ${t("common.egpShort")}`,
      color: "#F5A623", bg: "#FFF3E0",
    },
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
      <Text style={[styles.periodLabel, { color: colors.mutedForeground }]}>
        {isRTL ? "آخر 30 يوم" : "Last 30 days"}
      </Text>
      {summaries.map((s) => (
        <View
          key={s.label}
          style={[styles.commissionCard, { backgroundColor: s.bg, borderColor: s.color }]}
        >
          <Text style={[styles.commissionLabel, { color: s.color }]}>{s.label}</Text>
          <Text style={[styles.commissionValue, { color: s.color }]}>{s.value}</Text>
        </View>
      ))}
      <View style={[styles.infoCard, { backgroundColor: colors.muted, borderColor: colors.border, marginTop: 16 }]}>
        <VectorIcon name="info" size={14} color={colors.mutedForeground} />
        <Text style={[styles.infoText, { color: colors.mutedForeground, fontSize: 12 }]}>
          {isRTL
            ? "الأرقام تعكس بيانات الفواتير المصدرة خلال الفترة المحددة"
            : "Figures reflect issued invoices for the selected period"}
        </Text>
      </View>
    </ScrollView>
  );
}

function CollectionHubView({
  isRTL, colors, t, onSelect,
}: {
  isRTL: boolean; colors: ReturnType<typeof useColors>;
  t: (k: string) => string; onSelect: (v: CollSubView) => void;
}) {
  const items: { icon: IconName; color: string; bg: string; view: CollSubView; title: string; sub: string }[] = [
    {
      icon: "download",
      color: "#22A36B", bg: "#E8F8F0",
      view: "received",
      title: t("admin.coll.received"),
      sub: t("admin.coll.receivedDesc"),
    },
    {
      icon: "upload",
      color: "#E74C3C", bg: "#FDECEA",
      view: "refunded",
      title: t("admin.coll.refunded"),
      sub: t("admin.coll.refundedDesc"),
    },
    {
      icon: "credit-card",
      color: "#4DADD9", bg: "#E3F2FD",
      view: "tech_balances",
      title: t("admin.coll.techBalances"),
      sub: t("admin.coll.techBalancesDesc"),
    },
    {
      icon: "percent",
      color: "#7C5CBF", bg: "#EDE9FE",
      view: "commission",
      title: t("admin.coll.commission"),
      sub: t("admin.coll.commissionDesc"),
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.subHubContent}>
      {items.map((item) => (
        <HubCard
          key={item.view}
          icon={item.icon}
          iconColor={item.color}
          iconBg={item.bg}
          title={item.title}
          subtitle={item.sub}
          onPress={() => onSelect(item.view)}
          isRTL={isRTL}
          colors={colors}
        />
      ))}
    </ScrollView>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function AdminUsersScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [mainView, setMainView] = useState<MainView>("hub");
  const [techSubView, setTechSubView] = useState<TechSubView>("hub");
  const [collSubView, setCollSubView] = useState<CollSubView>("hub");
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [techCount, setTechCount] = useState<number | null>(null);

  const loadHubCounts = useCallback(async () => {
    if (!sessionToken) return;
    const base = getApiBase();
    if (!base) return;
    const headers = { Authorization: `Bearer ${sessionToken}` };
    try {
      const [clientsRes, techsRes] = await Promise.all([
        fetch(`${base}/api/admin/users/counts?role=client`, { headers }),
        fetch(`${base}/api/admin/users/counts?role=technician`, { headers }),
      ]);
      if (clientsRes.ok) {
        const data = await clientsRes.json() as { all?: number };
        setClientCount(data.all ?? 0);
      }
      if (techsRes.ok) {
        const data = await techsRes.json() as { all?: number };
        setTechCount(data.all ?? 0);
      }
    } catch { /* ignore */ }
  }, [sessionToken]);

  useFocusEffect(
    useCallback(() => {
      if (mainView === "hub") {
        loadHubCounts();
      }
      return () => {};
    }, [mainView, loadHubCounts])
  );

  function goBack() {
    if (mainView === "technicians" && techSubView === "list") {
      setTechSubView("hub");
    } else if (mainView === "collection" && collSubView !== "hub") {
      setCollSubView("hub");
    } else {
      setMainView("hub");
      setTechSubView("hub");
      setCollSubView("hub");
    }
  }

  function renderHeader() {
    if (mainView === "hub") {
      return (
        <AppHeader
          title={t("admin.users.hub.title")}
          subtitle={isRTL ? "إدارة المستخدمين والتحصيل" : "User & financial management"}
        />
      );
    }
    let title = "";
    let subtitle = "";

    if (mainView === "clients") {
      title = t("admin.users.clients");
      subtitle = t("admin.users.clientsDesc");
    } else if (mainView === "technicians") {
      if (techSubView === "hub") {
        title = t("admin.users.technicians");
        subtitle = t("admin.users.techniciansDesc");
      } else {
        title = t("admin.tech.list");
      }
    } else if (mainView === "collection") {
      if (collSubView === "hub") {
        title = t("admin.users.collection");
        subtitle = t("admin.users.collectionDesc");
      } else if (collSubView === "received") {
        title = t("admin.coll.received");
      } else if (collSubView === "refunded") {
        title = t("admin.coll.refunded");
      } else if (collSubView === "tech_balances") {
        title = t("admin.coll.techBalances");
      } else if (collSubView === "commission") {
        title = t("admin.coll.commission");
      }
    }

    return (
      <SubHeader
        title={title}
        subtitle={subtitle}
        onBack={goBack}
        isRTL={isRTL}
        colors={colors}
      />
    );
  }

  function renderContent() {
    if (mainView === "hub") {
      const cards: {
        icon: IconName; iconColor: string; iconBg: string;
        title: string; subtitle: string; view: MainView;
        badge?: string | number; badgeColor?: string;
      }[] = [
        {
          icon: "user",
          iconColor: "#4DADD9", iconBg: "#E3F2FD",
          title: t("admin.users.clients"),
          subtitle: t("admin.users.clientsDesc"),
          view: "clients",
          badge: clientCount ?? undefined,
          badgeColor: "#4DADD9",
        },
        {
          icon: "tool",
          iconColor: "#F5A623", iconBg: "#FFF3E0",
          title: t("admin.users.technicians"),
          subtitle: t("admin.users.techniciansDesc"),
          view: "technicians",
          badge: techCount ?? undefined,
          badgeColor: "#F5A623",
        },
        {
          icon: "clipboard",
          iconColor: "#7C5CBF", iconBg: "#EDE9FE",
          title: t("admin.users.loginLogs"),
          subtitle: t("admin.users.loginLogsDesc"),
          view: "hub",
        },
        {
          icon: "credit-card",
          iconColor: "#22A36B", iconBg: "#E8F8F0",
          title: t("admin.users.collection"),
          subtitle: t("admin.users.collectionDesc"),
          view: "collection",
        },
      ];

      return (
        <ScrollView
          contentContainerStyle={[styles.hubContent, { paddingBottom: botPad + 80 }]}
        >
          <View style={[styles.hubGrid]}>
            {cards.map((card) => (
              <HubCard
                key={card.view + card.title}
                icon={card.icon}
                iconColor={card.iconColor}
                iconBg={card.iconBg}
                title={card.title}
                subtitle={card.subtitle}
                badge={card.badge}
                badgeColor={card.badgeColor}
                onPress={() => {
                  if (card.title === t("admin.users.loginLogs")) {
                    router.push("/(admin)/(tabs)/login-logs");
                  } else {
                    setMainView(card.view);
                  }
                }}
                isRTL={isRTL}
                colors={colors}
              />
            ))}
          </View>
        </ScrollView>
      );
    }

    if (mainView === "clients") {
      return (
        <UserListView
          role="client"
          isRTL={isRTL}
          colors={colors}
          t={t}
          sessionToken={sessionToken}
        />
      );
    }

    if (mainView === "technicians") {
      if (techSubView === "hub") {
        return (
          <TechHubView
            isRTL={isRTL}
            colors={colors}
            t={t}
            onShowList={() => setTechSubView("list")}
            router={router}
            sessionToken={sessionToken}
          />
        );
      }
      return (
        <UserListView
          role="technician"
          isRTL={isRTL}
          colors={colors}
          t={t}
          sessionToken={sessionToken}
        />
      );
    }

    if (mainView === "collection") {
      if (collSubView === "hub") {
        return (
          <CollectionHubView
            isRTL={isRTL}
            colors={colors}
            t={t}
            onSelect={setCollSubView}
          />
        );
      }
      if (collSubView === "received") {
        return <ReceivedView sessionToken={sessionToken} isRTL={isRTL} colors={colors} t={t} />;
      }
      if (collSubView === "refunded") {
        return <RefundedView isRTL={isRTL} colors={colors} t={t} />;
      }
      if (collSubView === "tech_balances") {
        return <TechBonusGrantsPanel sessionToken={sessionToken} isRTL={isRTL} colors={colors} />;
      }
      if (collSubView === "commission") {
        return <CommissionView sessionToken={sessionToken} isRTL={isRTL} colors={colors} t={t} />;
      }
    }

    return null;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {renderHeader()}
      {renderContent()}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  // Hub
  hubContent: { padding: 16, gap: 12 },
  hubGrid: { gap: 12 },
  hubCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  hubCardInner: {
    padding: 16,
    alignItems: "center",
    gap: 12,
  },
  hubIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  hubCardText: { flex: 1, gap: 4 },
  hubCardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  hubCardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  hubBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  hubBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },

  // Sub-header
  subHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: "center",
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  subHeaderText: { flex: 1, gap: 2 },
  subHeaderTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
  subHeaderSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },

  // Sub-hub
  subHubContent: { padding: 16, gap: 12, paddingBottom: 100 },

  // Filters
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 0,
  },
  chipRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },

  // User rows
  userRow: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
    alignItems: "center",
    gap: 10,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  userInfo: { flex: 1, gap: 3 },
  userName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  userSub: { fontFamily: "Inter_400Regular", fontSize: 12 },
  userMeta: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  userActions: { alignItems: "center", gap: 6, flexShrink: 0 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 68,
    alignItems: "center",
  },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  // Collection
  collRow: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    padding: 14,
    alignItems: "center",
    gap: 12,
  },
  collLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  collSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  collValue: { fontFamily: "Inter_700Bold", fontSize: 14, flexShrink: 0 },

  summaryCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 16,
    alignItems: "center",
    gap: 6,
  },
  summaryLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  summaryValue: { fontFamily: "Inter_700Bold", fontSize: 26 },

  commissionCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commissionLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  commissionValue: { fontFamily: "Inter_700Bold", fontSize: 16 },

  periodLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginBottom: 10,
  },

  // Info
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },

  // Coming soon
  comingSoonIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  comingSoonTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    marginBottom: 8,
  },
  comingSoonDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  featureTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },

  // Shared
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
  modalSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  modalInput: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlignVertical: "top",
  },
  modalActions: {
    gap: 10,
    justifyContent: "flex-end",
  },
  modalBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
