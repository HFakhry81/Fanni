import React, { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  Modal,
  KeyboardAvoidingView,
  Switch,
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import DateTimePicker from "@react-native-community/datetimepicker";
import VectorIcon, { type IconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

type UserTab = "technicians" | "clients" | "admins" | "permissions";
type StatusFilter = "all" | "active" | "suspended";

const APP_SESSION_KEY = `fanni_session_${Date.now()}`;
const savedTabFilters: Partial<Record<UserTab, StatusFilter>> = {};

interface ApiUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  role: "client" | "technician" | "admin" | null;
  isActive: boolean;
  isAvailable: boolean | null;
  mustChangePassword?: boolean;
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

const TAB_ROLE_MAP: Partial<Record<UserTab, string>> = {
  technicians: "technician",
  clients: "client",
  admins: "admin",
};

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function generateStrongPassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;
  const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
  const base = [rand(upper), rand(lower), rand(digits), rand(special)];
  for (let i = 0; i < 8; i++) base.push(rand(all));
  return base.sort(() => Math.random() - 0.5).join("");
}

export default function AdminUsersScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken, user: currentUser } = useAuth();

  const [tab, setTab] = useState<UserTab>("technicians");
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterReady, setFilterReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPage = useRef(1);
  const replaceAbortController = useRef<AbortController | null>(null);
  const countsAbortController = useRef<AbortController | null>(null);
  const isLoadingMoreRef = useRef(false);

  const [baselineTotals, setBaselineTotals] = useState<Partial<Record<UserTab, number>>>({});
  const [statusCounts, setStatusCounts] = useState<{ all: number | null; active: number | null; suspended: number | null }>({ all: null, active: null, suspended: null });

  const [resetTarget, setResetTarget] = useState<ApiUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [confirmedPassword, setConfirmedPassword] = useState<string | null>(null);
  const [confirmedForName, setConfirmedForName] = useState<string>("");
  const [copied, setCopied] = useState(false);

  interface AuditLogEntry {
    id: number;
    changedById: string;
    changedByName: string;
    changedByRole: string;
    oldValue: boolean;
    newValue: boolean;
    createdAt: string;
  }
  const [auditTarget, setAuditTarget] = useState<ApiUser | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditFrom, setAuditFrom] = useState<Date | null>(null);
  const [auditTo, setAuditTo] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Permissions tab state
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminsList, setAdminsList] = useState<{ id: string; name: string; email: string | null; permissions: string[] }[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [permsSaving, setPermsSaving] = useState<string | null>(null);
  const [permsMsg, setPermsMsg] = useState<{ id: string; msg: string } | null>(null);

  const NAMED_PERMISSIONS = [
    { id: "view_reports",    label: isRTL ? "عرض التقارير المالية" : "View Reports",  color: "#22A36B" },
    { id: "manage_users",    label: isRTL ? "إدارة المستخدمين"    : "Manage Users",   color: "#4DADD9" },
    { id: "override_orders", label: isRTL ? "تجاوز الطلبات"       : "Override Orders", color: "#7C5CBF" },
  ];

  // Fetch super-admin status and admins list for permissions tab
  useEffect(() => {
    if (!sessionToken) return;
    const apiBase = getApiBaseUrl();
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/admin/my-permissions`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (res.ok) {
          const data = await res.json() as { isSuperAdmin?: boolean };
          setIsSuperAdmin(!!data.isSuperAdmin);
        }
      } catch {}
    })();
  }, [sessionToken]);

  const fetchAdminsPerms = useCallback(async () => {
    if (!sessionToken || !isSuperAdmin) return;
    setPermsLoading(true);
    try {
      const apiBase = getApiBaseUrl();
      const [listRes] = await Promise.all([
        fetch(`${apiBase}/api/admin/admins-list`, { headers: { Authorization: `Bearer ${sessionToken}` } }),
      ]);
      if (listRes.ok) {
        const listData = await listRes.json() as { admins?: { id: string; name: string; email: string | null; isSuperAdmin: boolean; isActive: boolean }[] };
        const nonSuper = (listData.admins ?? []).filter((a) => !a.isSuperAdmin && a.isActive);
        const permsResults = await Promise.all(
          nonSuper.map(async (admin) => {
            try {
              const r = await fetch(`${apiBase}/api/admin/${admin.id}/permissions`, {
                headers: { Authorization: `Bearer ${sessionToken}` },
              });
              const d = await r.json() as { permissions?: string[] };
              return { ...admin, permissions: d.permissions ?? [] };
            } catch {
              return { ...admin, permissions: [] };
            }
          })
        );
        setAdminsList(permsResults);
      }
    } catch {}
    setPermsLoading(false);
  }, [sessionToken, isSuperAdmin]);

  useEffect(() => {
    if (tab === "permissions" && isSuperAdmin) {
      fetchAdminsPerms();
    }
  }, [tab, isSuperAdmin, fetchAdminsPerms]);

  const toggleAdminPermission = useCallback(async (adminId: string, permId: string, currentPerms: string[]) => {
    if (!sessionToken) return;
    const newPerms = currentPerms.includes(permId)
      ? currentPerms.filter((p) => p !== permId)
      : [...currentPerms, permId];

    setAdminsList((prev) => prev.map((a) => a.id === adminId ? { ...a, permissions: newPerms } : a));
    setPermsSaving(adminId + ":" + permId);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/admin/users/${adminId}/permissions`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: newPerms }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setPermsMsg({ id: adminId, msg: data.error ?? (isRTL ? "فشل الحفظ" : "Save failed") });
        // Revert
        setAdminsList((prev) => prev.map((a) => a.id === adminId ? { ...a, permissions: currentPerms } : a));
      } else {
        setPermsMsg({ id: adminId, msg: isRTL ? "تم الحفظ ✓" : "Saved ✓" });
        setTimeout(() => setPermsMsg(null), 2000);
      }
    } catch {
      setAdminsList((prev) => prev.map((a) => a.id === adminId ? { ...a, permissions: currentPerms } : a));
    } finally {
      setPermsSaving(null);
    }
  }, [sessionToken, isRTL]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 400);
  }, []);

  const fetchCounts = useCallback(async (search?: string) => {
    if (!sessionToken || tab === "permissions") return;
    countsAbortController.current?.abort();
    const controller = new AbortController();
    countsAbortController.current = controller;
    setStatusCounts({ all: null, active: null, suspended: null });
    const role = TAB_ROLE_MAP[tab];
    const apiBase = getApiBaseUrl();
    const searchParam = search && search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
    try {
      const res = await fetch(
        `${apiBase}/api/admin/users/counts?role=${role}${searchParam}`,
        { headers: { Authorization: `Bearer ${sessionToken}` }, signal: controller.signal }
      );
      if (!res.ok) {
        setStatusCounts({ all: null, active: null, suspended: null });
        return;
      }
      const data = await res.json() as { all: number; active: number; suspended: number };
      setStatusCounts({ all: data.all, active: data.active, suspended: data.suspended });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setStatusCounts({ all: null, active: null, suspended: null });
    }
  }, [sessionToken, tab]);

  const fetchUsers = useCallback(async (page: number, replace: boolean, search?: string) => {
    if (!sessionToken) return;
    if (tab === "permissions") return;

    const role = TAB_ROLE_MAP[tab];
    const apiBase = getApiBaseUrl();
    const searchParam = search && search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
    const isActiveParam = statusFilter === "active" ? "&isActive=true" : statusFilter === "suspended" ? "&isActive=false" : "";

    if (replace) {
      // Cancel any in-flight replacement request so the latest query always wins
      replaceAbortController.current?.abort();
      const controller = new AbortController();
      replaceAbortController.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${apiBase}/api/admin/users?page=${page}&limit=20&role=${role}${searchParam}${isActiveParam}`,
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
        if (!search?.trim() && statusFilter === "all") {
          setBaselineTotals((prev) => ({ ...prev, [tab]: data.pagination.total }));
        }
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
        const res = await fetch(
          `${apiBase}/api/admin/users?page=${page}&limit=20&role=${role}${searchParam}${isActiveParam}`,
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
  }, [sessionToken, tab, statusFilter]);

  useEffect(() => {
    if (!filterReady) return;
    currentPage.current = 1;
    fetchUsers(1, true, debouncedSearch);
  }, [fetchUsers, debouncedSearch, filterReady]);

  useEffect(() => {
    if (!filterReady) return;
    fetchCounts(debouncedSearch);
  }, [fetchCounts, debouncedSearch, filterReady]);

  useEffect(() => {
    (async () => {
      const tabKeys: UserTab[] = ["technicians", "clients", "admins"];
      await Promise.all(
        tabKeys.map(async (t) => {
          const raw = await AsyncStorage.getItem(`users_status_filter_${t}`).catch(() => null);
          if (!raw) return;
          try {
            const parsed = JSON.parse(raw) as { filter?: string; session?: string };
            if (
              parsed.session === APP_SESSION_KEY &&
              (parsed.filter === "active" || parsed.filter === "suspended" || parsed.filter === "all")
            ) {
              savedTabFilters[t] = parsed.filter;
            }
          } catch {}
        })
      );
      setStatusFilter(savedTabFilters["technicians"] ?? "all");
      setFilterReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!filterReady || tab === "permissions") return;
    savedTabFilters[tab] = statusFilter;
    AsyncStorage.setItem(
      `users_status_filter_${tab}`,
      JSON.stringify({ filter: statusFilter, session: APP_SESSION_KEY })
    ).catch(() => {});
  }, [tab, statusFilter, filterReady]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      replaceAbortController.current?.abort();
      countsAbortController.current?.abort();
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

  const openResetModal = useCallback((user: ApiUser) => {
    setResetTarget(user);
    setResetPassword("");
    setShowResetPassword(false);
    setResetError(null);
  }, []);

  const closeResetModal = useCallback(() => {
    setResetTarget(null);
    setResetPassword("");
    setResetError(null);
  }, []);

  const fetchAuditLogs = useCallback(async (userId: string, from: Date | null, to: Date | null) => {
    if (!sessionToken) return;
    setAuditLogs([]);
    setAuditError(null);
    setAuditLoading(true);
    try {
      const apiBase = getApiBaseUrl();
      const params = new URLSearchParams();
      if (from) params.set("from", localDateString(from));
      if (to) params.set("to", localDateString(to));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${apiBase}/api/admin/technicians/${userId}/availability-log${qs}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { logs: AuditLogEntry[] };
      setAuditLogs(data.logs);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setAuditLoading(false);
    }
  }, [sessionToken]);

  const openAuditModal = useCallback(async (user: ApiUser) => {
    setAuditTarget(user);
    setAuditFrom(null);
    setAuditTo(null);
    setShowFromPicker(false);
    setShowToPicker(false);
    await fetchAuditLogs(user.id, null, null);
  }, [fetchAuditLogs]);

  const closeAuditModal = useCallback(() => {
    setAuditTarget(null);
    setAuditLogs([]);
    setAuditError(null);
    setAuditFrom(null);
    setAuditTo(null);
    setShowFromPicker(false);
    setShowToPicker(false);
  }, []);

  const applyAuditFilter = useCallback(() => {
    if (!auditTarget) return;
    fetchAuditLogs(auditTarget.id, auditFrom, auditTo);
  }, [auditTarget, auditFrom, auditTo, fetchAuditLogs]);

  const exportAuditCSV = useCallback(async () => {
    if (!auditTarget || !sessionToken) return;
    setIsExporting(true);
    try {
      const apiBase = getApiBaseUrl();
      const params = new URLSearchParams({ limit: "500" });
      if (auditFrom) params.set("from", localDateString(auditFrom));
      if (auditTo) params.set("to", localDateString(auditTo));
      const res = await fetch(`${apiBase}/api/admin/technicians/${auditTarget.id}/availability-log?${params.toString()}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { logs: AuditLogEntry[] };
      const allLogs = data.logs;
      if (allLogs.length === 0) {
        Alert.alert(isRTL ? "لا توجد بيانات" : "No data", isRTL ? "لا توجد سجلات للتصدير في هذه الفترة" : "No log entries to export for this period");
        return;
      }
      const escCsv = (v: string) => `"${v.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
      const headers = ["Date", "Changed By", "Role", "From", "To"].map(escCsv).join(",");
      const rows = allLogs.map((entry) => {
        const date = new Date(entry.createdAt).toLocaleString("en-GB");
        const from = entry.oldValue ? "Available" : "Unavailable";
        const to = entry.newValue ? "Available" : "Unavailable";
        return [date, entry.changedByName, entry.changedByRole, from, to].map(escCsv).join(",");
      });
      const csv = [headers, ...rows].join("\n");
      const name = [auditTarget.firstName, auditTarget.lastName].filter(Boolean).join("_") || auditTarget.id;
      const filename = `availability_log_${name}_${Date.now()}.csv`;
      const file = new File(Paths.cache, filename);
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: isRTL ? "تصدير سجل التواجد" : "Export Availability Log" });
      } else {
        Alert.alert(isRTL ? "غير مدعوم" : "Not supported", isRTL ? "المشاركة غير متاحة على هذا الجهاز" : "Sharing is not available on this device");
      }
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل تصدير الملف" : "Failed to export file");
    } finally {
      setIsExporting(false);
    }
  }, [auditTarget, sessionToken, auditFrom, auditTo, isRTL]);

  const submitPasswordReset = useCallback(async () => {
    if (!resetTarget || !sessionToken) return;
    if (!resetPassword.trim()) {
      setResetError(isRTL ? "أدخل كلمة المرور الجديدة" : "Enter a new password");
      return;
    }
    setIsResetting(true);
    setResetError(null);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/admin/admins/${resetTarget.id}/reset-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        setResetError(data.error ?? (isRTL ? "فشل إعادة تعيين كلمة المرور" : "Failed to reset password"));
        return;
      }
      const passwordToShow = resetPassword;
      const nameForModal = resetTarget.firstName ?? (isRTL ? "المدير" : "Admin");
      closeResetModal();
      setConfirmedPassword(passwordToShow);
      setConfirmedForName(nameForModal);
      setCopied(false);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : (isRTL ? "فشل إعادة تعيين كلمة المرور" : "Failed to reset password"));
    } finally {
      setIsResetting(false);
    }
  }, [resetTarget, sessionToken, resetPassword, isRTL, closeResetModal]);

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

  const toggleAvailability = useCallback(async (user: ApiUser) => {
    if (!sessionToken) return;
    const newValue = !user.isAvailable;
    const action = newValue
      ? (isRTL ? "تفعيل التواجد" : "Set Available")
      : (isRTL ? "إيقاف التواجد" : "Set Unavailable");
    Alert.alert(
      action,
      isRTL
        ? `هل تريد ${newValue ? "تفعيل" : "إيقاف"} تواجد ${user.firstName ?? "الفني"}؟`
        : `Mark ${user.firstName ?? "this technician"} as ${newValue ? "available" : "unavailable"}?`,
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: action,
          style: "default",
          onPress: async () => {
            setUpdatingId(user.id);
            try {
              const apiBase = getApiBaseUrl();
              const res = await fetch(`${apiBase}/api/technicians/${user.id}/availability`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${sessionToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ isAvailable: newValue }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
              }
              setUsers((prev) =>
                prev.map((u) => u.id === user.id ? { ...u, isAvailable: newValue } : u)
              );
            } catch (err) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                err instanceof Error ? err.message : "Failed to update availability"
              );
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  }, [sessionToken, isRTL]);

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
    const isTechnician = item.role === "technician";
    const isAvailable = item.isAvailable === true;
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
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={[styles.statusBadge, { backgroundColor: isActive ? "#D4EDDA" : "#FFE6E6", borderRadius: 8 }]}>
                <Text style={{ color: isActive ? colors.success : colors.destructive, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                  {isActive ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Suspended")}
                </Text>
              </View>
              {isTechnician ? (
                <View style={[styles.statusBadge, { backgroundColor: isAvailable ? "#E6F4FF" : "#F5F5F5", borderRadius: 8 }]}>
                  <Text style={{ color: isAvailable ? "#0284C7" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                    {isAvailable ? (isRTL ? "متاح" : "Available") : (isRTL ? "غير متاح" : "Unavailable")}
                  </Text>
                </View>
              ) : null}
              {item.role === "admin" && item.mustChangePassword ? (
                <View style={[styles.statusBadge, { backgroundColor: "#FEF3C7", borderRadius: 8, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 3 }]}>
                  <Text style={{ fontSize: 10 }}>⚠️</Text>
                  <Text style={{ color: "#92400E", fontFamily: "Inter_600SemiBold", fontSize: 10 }}>
                    {isRTL ? "يجب تغيير كلمة المرور" : "Must change password"}
                  </Text>
                </View>
              ) : null}
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
            {isTechnician ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: isAvailable ? "#F0F9FF" : "#E6F4FF", borderRadius: colors.radius - 4, opacity: isUpdating ? 0.5 : 1 }]}
                onPress={() => toggleAvailability(item)}
                disabled={isUpdating}
              >
                <VectorIcon name={isAvailable ? "wifi-off" : "wifi"} size={14} color="#0284C7" />
                <Text style={{ color: "#0284C7", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                  {isAvailable ? (isRTL ? "إيقاف التواجد" : "Set Offline") : (isRTL ? "تفعيل التواجد" : "Set Online")}
                </Text>
              </TouchableOpacity>
            ) : null}
            {isTechnician ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#F5F3FF", borderRadius: colors.radius - 4, flex: 0, paddingHorizontal: 12 }]}
                onPress={() => openAuditModal(item)}
              >
                <VectorIcon name="clock" size={14} color="#7C3AED" />
                <Text style={{ color: "#7C3AED", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                  {isRTL ? "السجل" : "Log"}
                </Text>
              </TouchableOpacity>
            ) : null}
            {item.role === "admin" && item.id !== currentUser?.id ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#F5F3FF", borderRadius: colors.radius - 4, opacity: isUpdating ? 0.5 : 1 }]}
                onPress={() => openResetModal(item)}
                disabled={isUpdating}
              >
                <VectorIcon name="key" size={14} color="#7C3AED" />
                <Text style={{ color: "#7C3AED", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                  {isRTL ? "إعادة تعيين" : "Reset PW"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const tabs: [UserTab, string][] = [
    ["technicians", t("admin.technicians")],
    ["clients", t("admin.clients")],
    ["admins", isRTL ? "مديرون" : "Admins"],
    ...(isSuperAdmin ? [["permissions", isRTL ? "الصلاحيات" : "Permissions"] as [UserTab, string]] : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("admin.users")}
        subtitle={tab === "permissions"
          ? (isRTL ? "إدارة الصلاحيات" : "Manage Permissions")
          : (() => {
            if (!pagination) return isRTL ? "جارٍ التحميل..." : "Loading...";
            const isFiltered = debouncedSearch.trim().length > 0 || statusFilter !== "all";
            const baseline = baselineTotals[tab] ?? null;
            if (isFiltered && baseline !== null) {
              return isRTL
                ? `${pagination.total} من ${baseline} مستخدم`
                : `${pagination.total} of ${baseline} users`;
            }
            return `${pagination.total} ${isRTL ? "مستخدم" : "users"}`;
          })()}
        showHome
        showLogout
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBarScroll, { backgroundColor: colors.card }]}
        contentContainerStyle={{ paddingHorizontal: 4, paddingVertical: 4, gap: 4, flexDirection: isRTL ? "row-reverse" : "row" }}
      >
        {tabs.map(([key, label]) => {
          const icons: Record<string, IconName> = { technicians: "tool", clients: "users", admins: "shield", permissions: "lock" };
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tab, { backgroundColor: tab === key ? colors.secondary : "transparent", borderRadius: colors.radius - 4 }]}
              onPress={() => {
                if (tab !== key) {
                  if (debounceTimer.current) clearTimeout(debounceTimer.current);
                  setSearchQuery("");
                  setDebouncedSearch("");
                  setStatusFilter(savedTabFilters[key] ?? "all");
                  setTab(key);
                }
              }}
            >
              <VectorIcon
                name={icons[key] ?? "users"}
                size={14}
                color={tab === key ? "#FFF" : colors.mutedForeground}
              />
              <Text style={{ color: tab === key ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 5 }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tab === "permissions" ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}>
          {permsLoading ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <ActivityIndicator size="large" color={colors.secondary} />
            </View>
          ) : adminsList.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <VectorIcon name="users" size={48} color={colors.border} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 12, textAlign: "center" }}>
                {isRTL ? "لا يوجد مسئولون آخرون" : "No other admins to manage"}
              </Text>
            </View>
          ) : (
            adminsList.map((admin) => (
              <View key={admin.id} style={[{ backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, borderWidth: 1.5, marginBottom: 14, padding: 16 }]}>
                <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", marginBottom: 14 }]}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#7C3AED22", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#7C3AED", fontFamily: "Inter_700Bold", fontSize: 18 }}>{admin.name[0]?.toUpperCase() ?? "?"}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>{admin.name}</Text>
                    {admin.email ? <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>{admin.email}</Text> : null}
                  </View>
                  {permsMsg?.id === admin.id ? (
                    <Text style={{ color: permsMsg.msg.includes("✓") ? colors.success : colors.destructive, fontFamily: "Inter_500Medium", fontSize: 12 }}>{permsMsg.msg}</Text>
                  ) : null}
                </View>
                {NAMED_PERMISSIONS.map((perm) => {
                  const enabled = admin.permissions.includes(perm.id);
                  const isSavingThis = permsSaving === admin.id + ":" + perm.id;
                  return (
                    <View key={perm.id} style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }]}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: enabled ? perm.color : colors.border, marginRight: isRTL ? 0 : 10, marginLeft: isRTL ? 10 : 0 }} />
                      <Text style={{ flex: 1, color: enabled ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
                        {perm.label}
                      </Text>
                      {isSavingThis ? (
                        <ActivityIndicator size="small" color={perm.color} />
                      ) : (
                        <Switch
                          value={enabled}
                          onValueChange={() => toggleAdminPermission(admin.id, perm.id, admin.permissions)}
                          trackColor={{ false: colors.border, true: perm.color + "88" }}
                          thumbColor={enabled ? perm.color : "#C8D8E8"}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      ) : (
      <><View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

      <View style={[styles.filterRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {(["all", "active", "suspended"] as StatusFilter[]).map((f) => {
          const isSelected = statusFilter === f;
          const baseLabel = f === "all"
            ? (isRTL ? "الكل" : "All")
            : f === "active"
            ? (isRTL ? "نشط" : "Active")
            : (isRTL ? "موقوف" : "Suspended");
          const count = statusCounts[f];
          const label = count !== null ? `${baseLabel} (${count})` : baseLabel;
          const selectedBg = f === "suspended" ? "#FFE6E6" : f === "active" ? "#D4EDDA" : colors.secondary;
          const selectedColor = f === "suspended" ? colors.destructive : f === "active" ? colors.success : "#FFF";
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterPill,
                {
                  backgroundColor: isSelected ? selectedBg : colors.card,
                  borderColor: isSelected ? selectedBg : colors.border,
                },
              ]}
              onPress={() => {
                if (statusFilter !== f) {
                  setStatusFilter(f);
                }
              }}
            >
              <Text style={{
                color: isSelected ? selectedColor : colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal
        visible={resetTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeResetModal}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
              <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <VectorIcon name="key" size={18} color="#7C3AED" />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                  {isRTL ? "إعادة تعيين كلمة المرور" : "Reset Password"}
                </Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 16, textAlign: isRTL ? "right" : "left" }}>
                {isRTL
                  ? `إعادة تعيين كلمة مرور ${resetTarget?.firstName ?? "المدير"}. سيُطلب منهم تغييرها عند تسجيل الدخول التالي.`
                  : `Reset password for ${resetTarget?.firstName ?? "this admin"}. They will be required to change it on next login.`}
              </Text>

              <View style={[styles.passwordRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
                  placeholder={isRTL ? "كلمة المرور الجديدة" : "New password"}
                  placeholderTextColor={colors.mutedForeground}
                  value={resetPassword}
                  onChangeText={(t) => { setResetPassword(t); setResetError(null); }}
                  secureTextEntry={!showResetPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowResetPassword((v) => !v)} style={{ padding: 4 }}>
                  <VectorIcon name={showResetPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.generateBtn, { borderColor: "#7C3AED" }]}
                onPress={() => { setResetPassword(generateStrongPassword()); setShowResetPassword(true); setResetError(null); }}
              >
                <VectorIcon name="refresh-cw" size={14} color="#7C3AED" />
                <Text style={{ color: "#7C3AED", fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>
                  {isRTL ? "توليد كلمة مرور" : "Generate password"}
                </Text>
              </TouchableOpacity>

              {resetError ? (
                <Text style={{ color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 8, textAlign: isRTL ? "right" : "left" }}>
                  {resetError}
                </Text>
              ) : null}

              <View style={[styles.modalActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}
                  onPress={closeResetModal}
                  disabled={isResetting}
                >
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                    {isRTL ? "إلغاء" : "Cancel"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: "#7C3AED", borderRadius: colors.radius - 4, opacity: isResetting ? 0.6 : 1 }]}
                  onPress={submitPasswordReset}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                      {isRTL ? "إعادة تعيين" : "Reset"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={confirmedPassword !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setConfirmedPassword(null); setCopied(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "center", marginBottom: 8 }]}>
              <VectorIcon name="check-circle" size={22} color="#22A36B" />
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                {isRTL ? "تم إعادة التعيين" : "Password Reset"}
              </Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: isRTL ? "right" : "left", marginBottom: 16 }}>
              {isRTL
                ? `تم إعادة تعيين كلمة مرور ${confirmedForName} بنجاح. احفظ كلمة المرور الجديدة وشاركها بشكل آمن — لن تُعرض مجدداً.`
                : `${confirmedForName}'s password has been reset. Copy it now to share securely — it won't be shown again.`}
            </Text>

            <View style={[styles.passwordRow, { borderColor: "#7C3AED", backgroundColor: colors.background, marginBottom: 12 }]}>
              <Text
                selectable
                style={[styles.passwordInput, { color: colors.foreground, letterSpacing: 1.5, fontFamily: "Inter_700Bold", fontSize: 15 }]}
              >
                {confirmedPassword}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.generateBtn, { borderColor: copied ? "#22A36B" : "#7C3AED", backgroundColor: copied ? "#F0FDF4" : "transparent" }]}
              onPress={async () => {
                if (confirmedPassword) {
                  try {
                    await Clipboard.setStringAsync(confirmedPassword);
                    setCopied(true);
                  } catch {
                    Alert.alert(
                      isRTL ? "خطأ" : "Error",
                      isRTL ? "تعذّر النسخ إلى الحافظة" : "Could not copy to clipboard"
                    );
                  }
                }
              }}
            >
              <VectorIcon name={copied ? "check" : "copy"} size={15} color={copied ? "#22A36B" : "#7C3AED"} />
              <Text style={{ color: copied ? "#22A36B" : "#7C3AED", fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>
                {copied
                  ? (isRTL ? "تم النسخ!" : "Copied!")
                  : (isRTL ? "نسخ إلى الحافظة" : "Copy to clipboard")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#7C3AED", borderRadius: colors.radius - 4, marginTop: 16 }]}
              onPress={() => { setConfirmedPassword(null); setCopied(false); }}
            >
              <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                {isRTL ? "تم" : "Done"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={auditTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeAuditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius, maxHeight: "88%" }]}>
            <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between" }]}>
              <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center" }}>
                <VectorIcon name="clock" size={18} color="#7C3AED" />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                  {isRTL ? "سجل التواجد" : "Availability Log"}
                </Text>
              </View>
              <TouchableOpacity onPress={closeAuditModal} style={{ padding: 4 }}>
                <VectorIcon name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {auditTarget ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 10, textAlign: isRTL ? "right" : "left" }}>
                {isRTL
                  ? `تغييرات التواجد لـ ${auditTarget.firstName ?? "الفني"}`
                  : `Availability changes for ${auditTarget.firstName ?? "this technician"}`}
              </Text>
            ) : null}

            {/* Date range filter */}
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowToPicker(false); setShowFromPicker(true); }}
                style={{ flex: 1, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 4, backgroundColor: colors.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              >
                <VectorIcon name="calendar" size={13} color={colors.mutedForeground} />
                <Text style={{ color: auditFrom ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, textAlign: isRTL ? "right" : "left" }} numberOfLines={1}>
                  {auditFrom ? auditFrom.toLocaleDateString(isRTL ? "ar-EG" : "en-GB") : (isRTL ? "من تاريخ" : "From date")}
                </Text>
                {auditFrom ? (
                  <TouchableOpacity onPress={() => setAuditFrom(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <VectorIcon name="x" size={12} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setShowFromPicker(false); setShowToPicker(true); }}
                style={{ flex: 1, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 4, backgroundColor: colors.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              >
                <VectorIcon name="calendar" size={13} color={colors.mutedForeground} />
                <Text style={{ color: auditTo ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, textAlign: isRTL ? "right" : "left" }} numberOfLines={1}>
                  {auditTo ? auditTo.toLocaleDateString(isRTL ? "ar-EG" : "en-GB") : (isRTL ? "إلى تاريخ" : "To date")}
                </Text>
                {auditTo ? (
                  <TouchableOpacity onPress={() => setAuditTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <VectorIcon name="x" size={12} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={applyAuditFilter}
                disabled={auditLoading}
                style={{ backgroundColor: "#7C3AED", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <VectorIcon name="search" size={15} color="#fff" />
              </TouchableOpacity>
            </View>

            {showFromPicker && (
              <DateTimePicker
                value={auditFrom ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                maximumDate={auditTo ?? new Date()}
                onChange={(_e, date) => {
                  setShowFromPicker(Platform.OS === "ios");
                  if (date) setAuditFrom(date);
                }}
              />
            )}
            {showToPicker && (
              <DateTimePicker
                value={auditTo ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={auditFrom ?? undefined}
                maximumDate={new Date()}
                onChange={(_e, date) => {
                  setShowToPicker(Platform.OS === "ios");
                  if (date) setAuditTo(date);
                }}
              />
            )}

            {auditLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            ) : auditError ? (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <VectorIcon name="alert-circle" size={32} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8, textAlign: "center" }}>
                  {auditError}
                </Text>
              </View>
            ) : auditLogs.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <VectorIcon name="inbox" size={36} color={colors.border} />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 10, textAlign: "center" }}>
                  {isRTL ? "لا توجد تغييرات في هذه الفترة" : "No changes in this period"}
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                {auditLogs.map((entry, idx) => {
                  const isFirst = idx === 0;
                  const changedToAvailable = entry.newValue;
                  const dot = changedToAvailable ? "#22A36B" : "#EF4444";
                  const oldLabel = entry.oldValue ? (isRTL ? "متاح" : "Available") : (isRTL ? "غير متاح" : "Unavailable");
                  const newLabel = entry.newValue ? (isRTL ? "متاح" : "Available") : (isRTL ? "غير متاح" : "Unavailable");
                  const label = `${oldLabel} → ${newLabel}`;
                  const byLabel = entry.changedByRole === "admin"
                    ? (isRTL ? "بواسطة مدير" : "by admin")
                    : (isRTL ? "بواسطة الفني" : "by technician");
                  let dateStr = "";
                  try {
                    dateStr = new Date(entry.createdAt).toLocaleString(isRTL ? "ar-EG" : "en-GB", {
                      year: "numeric", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    });
                  } catch { dateStr = entry.createdAt; }
                  return (
                    <View
                      key={entry.id}
                      style={{
                        flexDirection: isRTL ? "row-reverse" : "row",
                        alignItems: "flex-start",
                        paddingVertical: 10,
                        borderTopWidth: isFirst ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot, marginTop: 3, marginRight: isRTL ? 0 : 10, marginLeft: isRTL ? 10 : 0 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
                          {label}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: isRTL ? "right" : "left" }}>
                          {entry.changedByName} · {byLabel}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
                          {dateStr}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 8, marginTop: 16 }}>
              {auditLogs.length > 0 && (
                <TouchableOpacity
                  onPress={exportAuditCSV}
                  disabled={isExporting}
                  style={[styles.modalBtn, { flex: 1, backgroundColor: "#7C3AED", borderRadius: colors.radius - 4, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 6 }]}
                >
                  {isExporting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <VectorIcon name="download" size={14} color="#fff" />}
                  <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {isRTL ? "تصدير CSV" : "Export CSV"}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}
                onPress={closeAuditModal}
              >
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  {isRTL ? "إغلاق" : "Close"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBarScroll: { maxHeight: 56, margin: 12, marginBottom: 0, borderRadius: 14 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center" },
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
  filterRow: { gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  filterPill: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  roleBadge: { alignSelf: "flex-start", paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6, marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 440, padding: 24, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  modalHeader: { alignItems: "center", marginBottom: 12 },
  passwordRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2, marginBottom: 10 },
  passwordInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 10 },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 10, paddingVertical: 10, marginBottom: 4 },
  modalActions: { gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
});
