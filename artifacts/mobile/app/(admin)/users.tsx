import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import StarRating from "@/components/StarRating";

const MOCK_USERS = [
  { id: "c1", type: "client", name: "أحمد محمد", mobile: "01012345678", status: "active", orders: 3 },
  { id: "c2", type: "client", name: "سارة أحمد", mobile: "01111223344", status: "active", orders: 1 },
  { id: "t1", type: "technician", name: "محمد علي", mobile: "01098765432", status: "active", orders: 8, specialty: "تكييف", rating: 4.8 },
  { id: "t2", type: "technician", name: "خالد حسن", mobile: "01234567890", status: "suspended", orders: 2, specialty: "كهرباء", rating: 4.2 },
  { id: "t3", type: "technician", name: "طارق إبراهيم", mobile: "01555666777", status: "active", orders: 15, specialty: "سباكة", rating: 4.9 },
];

type UserTab = "clients" | "technicians";

export default function AdminUsersScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<UserTab>("technicians");

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const filteredUsers = MOCK_USERS.filter(
    (u) => (tab === "clients" ? u.type === "client" : u.type === "technician")
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
          {t("admin.users")}
        </Text>
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {([["technicians", t("admin.technicians")], ["clients", t("admin.clients")]] as [UserTab, string][]).map(
          ([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.tabBtn,
                { backgroundColor: tab === key ? colors.primary : "transparent", borderRadius: colors.radius },
              ]}
              onPress={() => setTab(key)}
            >
              <Text style={{ color: tab === key ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                {label}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
        renderItem={({ item }) => (
          <View
            style={[
              styles.userCard,
              { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border },
            ]}
          >
            <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={[styles.avatar, { backgroundColor: item.type === "technician" ? colors.primary : colors.secondary }]}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18 }}>{item.name[0]}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
                  {item.name}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                  {item.mobile}
                </Text>
                {item.type === "technician" && (
                  <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                    {item.specialty}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: item.status === "active" ? "#E6F9F0" : "#FFE6E6",
                    borderRadius: 8,
                  },
                ]}
              >
                <Text
                  style={{
                    color: item.status === "active" ? colors.success : colors.destructive,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 11,
                  }}
                >
                  {item.status === "active" ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Suspended")}
                </Text>
              </View>
            </View>

            {item.type === "technician" && item.rating && (
              <View style={[styles.ratingRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <StarRating rating={item.rating} readonly size={14} />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: 6 }}>
                  {item.rating} ({item.orders} {isRTL ? "طلب" : "orders"})
                </Text>
              </View>
            )}

            <View style={[styles.actionRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.success + "22", borderRadius: colors.radius / 2 },
                ]}
              >
                <Feather name="check" size={14} color={colors.success} />
                <Text style={{ color: colors.success, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                  {t("admin.approve")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.destructive + "22", borderRadius: colors.radius / 2 },
                ]}
              >
                <Feather name="slash" size={14} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                  {t("admin.suspend")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTitle: { fontSize: 22 },
  tabRow: { margin: 12, padding: 4, borderRadius: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  userCard: { padding: 16, marginBottom: 12, borderWidth: 1.5 },
  cardHeader: { alignItems: "center", marginBottom: 10, gap: 0 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10 },
  ratingRow: { alignItems: "center", marginBottom: 12, gap: 0 },
  actionRow: { gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 0 },
});
