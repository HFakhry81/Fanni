import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import StarRating from "@/components/StarRating";
import AppHeader from "@/components/AppHeader";

const MOCK_USERS = [
  { id: "c1", type: "client",     name: "أحمد محمد",    nameEn: "Ahmed Mohamed",  mobile: "123",         status: "active",    orders: 3 },
  { id: "c2", type: "client",     name: "سارة أحمد",    nameEn: "Sara Ahmed",     mobile: "01111223344", status: "active",    orders: 1 },
  { id: "t1", type: "technician", name: "محمد علي",     nameEn: "Mohamed Ali",    mobile: "111",         status: "active",    orders: 8,  specialty: "تكييف / AC",    rating: 4.8 },
  { id: "t2", type: "technician", name: "خالد حسن",     nameEn: "Khaled Hassan",  mobile: "01234567890", status: "suspended", orders: 2,  specialty: "كهرباء / Elec", rating: 4.2 },
  { id: "t3", type: "technician", name: "طارق إبراهيم", nameEn: "Tarek Ibrahim", mobile: "01555666777", status: "active",    orders: 15, specialty: "سباكة / Plumb", rating: 4.9 },
];

type UserTab = "clients" | "technicians";

export default function AdminUsersScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<UserTab>("technicians");
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  const filtered = MOCK_USERS.filter((u) => tab === "clients" ? u.type === "client" : u.type === "technician");

  const toggleStatus = (id: string, current: string) => {
    setStatusMap((prev) => ({ ...prev, [id]: current === "active" ? "suspended" : "active" }));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("admin.users")}
        subtitle={`${filtered.length} ${isRTL ? "مستخدم" : "users"}`}
        showHome
        showLogout
      />

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {([["technicians", t("admin.technicians")], ["clients", t("admin.clients")]] as [UserTab, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, { backgroundColor: tab === key ? colors.secondary : "transparent", borderRadius: colors.radius - 4 }]}
            onPress={() => setTab(key)}
          >
            <Feather name={key === "technicians" ? "tool" : "users"} size={14} color={tab === key ? "#FFF" : colors.mutedForeground} />
            <Text style={{ color: tab === key ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 14, marginLeft: 5 }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
        renderItem={({ item }) => {
          const currentStatus = statusMap[item.id] ?? item.status;
          const isActive = currentStatus === "active";
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <View style={[styles.accentBar, { backgroundColor: isActive ? colors.success : colors.destructive }]} />
              <View style={styles.cardBody}>
                <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <View style={[styles.avatar, { backgroundColor: item.type === "technician" ? colors.secondary : colors.primary }]}>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18 }}>{item.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>{item.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>{item.mobile}</Text>
                    {item.specialty && (
                      <Text style={{ color: colors.secondary, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>{item.specialty}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: isActive ? "#D4EDDA" : "#FFE6E6", borderRadius: 8 }]}>
                    <Text style={{ color: isActive ? colors.success : colors.destructive, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                      {isActive ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Suspended")}
                    </Text>
                  </View>
                </View>

                {item.rating && (
                  <View style={[styles.ratingRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
                    <StarRating rating={item.rating} readonly size={14} />
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: 6 }}>
                      {item.rating} · {item.orders} {isRTL ? "طلب" : "orders"}
                    </Text>
                  </View>
                )}

                <View style={[styles.actionRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.accentBlue, borderRadius: colors.radius - 4 }]}
                    onPress={() => {}}
                  >
                    <Feather name="eye" size={14} color={colors.secondary} />
                    <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                      {isRTL ? "عرض" : "View"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: isActive ? "#FFE6E6" : "#D4EDDA", borderRadius: colors.radius - 4 }]}
                    onPress={() => toggleStatus(item.id, currentStatus)}
                  >
                    <Feather name={isActive ? "slash" : "check"} size={14} color={isActive ? colors.destructive : colors.success} />
                    <Text style={{ color: isActive ? colors.destructive : colors.success, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                      {isActive ? t("admin.suspend") : t("admin.approve")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />
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
  cardTop: { alignItems: "center", marginBottom: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10 },
  ratingRow: { alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1 },
  actionRow: { gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center" },
});
