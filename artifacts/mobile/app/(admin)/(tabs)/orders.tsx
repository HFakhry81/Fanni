import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Image, ImageSourcePropType, Linking } from "react-native";
import { useRouter } from "expo-router";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import StatusBadge from "@/components/StatusBadge";
import AppHeader from "@/components/AppHeader";

const SUB_IMAGE_MAP: Record<string, ImageSourcePropType> = {
  sub_electrical_wiring: require("@/assets/images/sub_electrical_wiring.webp"),
  sub_computers:         require("@/assets/images/sub_computers.webp"),
  sub_washing_machine:   require("@/assets/images/sub_washing_machine.webp"),
  sub_water_heater:      require("@/assets/images/sub_water_heater.webp"),
  sub_ac_repair:         require("@/assets/images/sub_ac_repair.webp"),
  sub_ac_cleaning:       require("@/assets/images/sub_ac_cleaning.webp"),
  sub_pipes:             require("@/assets/images/sub_pipes.webp"),
  sub_sanitary:          require("@/assets/images/sub_sanitary.webp"),
  sub_doors:             require("@/assets/images/sub_doors.webp"),
  sub_furniture:         require("@/assets/images/sub_furniture.webp"),
  sub_fridge:            require("@/assets/images/sub_fridge.webp"),
  sub_dishwasher:        require("@/assets/images/sub_dishwasher.webp"),
  sub_interior_paint:    require("@/assets/images/sub_interior_paint.webp"),
  sub_exterior_paint:    require("@/assets/images/sub_exterior_paint.webp"),
  sub_insects:           require("@/assets/images/sub_insects.webp"),
  sub_rodents:           require("@/assets/images/sub_rodents.webp"),
  sub_tiles:             require("@/assets/images/sub_tiles.webp"),
  sub_parquet:           require("@/assets/images/sub_parquet.webp"),
};

const DEFAULT_SERVICE_FEE_RATE = 15;
const DEFAULT_VAT_RATE = 14;

export default function AdminOrdersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { allOrders } = useOrders();
  const [filter, setFilter] = useState<string>("all");
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

  const statusFilters = ["all", "pending", "accepted", "completed", "cancelled"];
  const filteredOrders = filter === "all" ? allOrders : allOrders.filter((o) => o.status === filter);

  const filterColors: Record<string, string> = {
    all: colors.dark, pending: colors.primary, accepted: colors.secondary,
    completed: colors.success, cancelled: colors.destructive,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("admin.orders")}
        subtitle={
          filter === "all"
            ? `${allOrders.length} ${isRTL ? "طلب" : "orders"}`
            : isRTL
              ? `${filteredOrders.length} من ${allOrders.length} طلب`
              : `${filteredOrders.length} of ${allOrders.length} orders`
        }
        showHome
        showLogout
      />

      {/* Filter chips */}
      <View style={styles.filterRow}>
        <FlatList
          data={statusFilters}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive = filter === item;
            const chipColor = filterColors[item] ?? colors.dark;
            return (
              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? chipColor : colors.card,
                    borderColor: isActive ? chipColor : colors.border,
                    borderRadius: 20,
                  },
                ]}
                onPress={() => setFilter(item)}
              >
                <Text style={{ color: isActive ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                  {item === "all" ? (isRTL ? "الكل" : "All") : t(`order.status.${item}`)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={[...filteredOrders].reverse()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <VectorIcon name="inbox" size={48} color={colors.border} />
            <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 12, textAlign: "center", fontFamily: "Inter_400Regular" }}>{t("common.noData")}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const inv3 = item.threePartyInvoice;
          const invLegacy = item.invoice;
          const hasInvoice = item.status === "completed" && (!!inv3 || !!invLegacy);
          const invoiceExpanded = expandedInvoices[item.id] ?? false;

          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <View style={[styles.accentBar, { backgroundColor: filterColors[item.status] ?? colors.secondary }]} />
              <View style={styles.cardBody}>
                {/* Tappable header → navigates to order-details */}
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/order-details", params: { orderId: item.id } })}
                  activeOpacity={0.85}
                >
                  <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    {item.subImageKey && SUB_IMAGE_MAP[item.subImageKey] && (
                      <Image
                        source={SUB_IMAGE_MAP[item.subImageKey]}
                        style={[styles.subThumb, { borderRadius: colors.radius - 4, borderColor: colors.border }]}
                        resizeMode="cover"
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>{item.orderNumber}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                        {t(`cat.${item.category}`)} — {item.subCategory}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                  <View style={[styles.cardMid, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                        {isRTL ? "👤 " : "👤 "}{item.clientName}
                      </Text>
                      {item.technicianName && (
                        <Text style={{ color: colors.secondary, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                          🔧 {item.technicianName}
                        </Text>
                      )}
                    </View>
                    {(inv3 || invLegacy) && (
                      <View style={[styles.totalChip, { backgroundColor: colors.accent, borderRadius: 10 }]}>
                        <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                          {inv3 ? inv3.clientTotal.toFixed(0) : invLegacy!.total.toFixed(0)}
                        </Text>
                        <Text style={{ color: colors.primary, fontFamily: "Inter_400Regular", fontSize: 11 }}> {t("common.egp")}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.cardFoot, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <VectorIcon name="calendar" size={12} color={colors.mutedForeground} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 }}>{item.visitDate} {item.visitTime}</Text>
                  </View>
                </TouchableOpacity>

                {/* Technician contact row */}
                {item.technicianMobile && (
                  <View style={[styles.techContactRow, { borderTopColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <TouchableOpacity
                      style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", flex: 1, gap: 5 }}
                      onPress={() => Linking.openURL(`tel:${item.technicianMobile}`).catch(() => {})}
                      activeOpacity={0.7}
                    >
                      <VectorIcon name="phone" size={12} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginLeft: isRTL ? 0 : 2, marginRight: isRTL ? 2 : 0, direction: "ltr" }}>
                        {item.technicianMobile}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.callBtn, { backgroundColor: colors.primary, borderRadius: 8 }]}
                      onPress={() => Linking.openURL(`tel:${item.technicianMobile}`).catch(() => {})}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <VectorIcon name="phone" size={13} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smsBtn, { backgroundColor: colors.secondary, borderRadius: 8, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }]}
                      onPress={() => Linking.openURL(`sms:${item.technicianMobile}`).catch(() => {})}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <VectorIcon name="message-circle" size={13} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Expandable invoice section for completed orders */}
                {hasInvoice && (
                  <View style={[styles.invoiceBlock, { borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                    {/* Collapse/expand toggle */}
                    <TouchableOpacity
                      style={[styles.invoiceToggleRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: invoiceExpanded ? colors.border : "transparent" }]}
                      onPress={() => setExpandedInvoices((prev) => ({ ...prev, [item.id]: !invoiceExpanded }))}
                      activeOpacity={0.75}
                    >
                      <Image source={require("@/assets/images/icon.png")} style={styles.invoiceLogo} resizeMode="contain" />
                      <View style={{ flex: 1, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                        <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
                          {inv3
                            ? (isRTL ? "تفاصيل الفاتورة" : "Invoice Breakdown")
                            : `${t("invoice.title")} #${invLegacy!.invoiceNumber}`}
                        </Text>
                        <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                          {inv3
                            ? `${isRTL ? "إجمالي العميل" : "Client Total"}: ${inv3.clientTotal.toFixed(2)} ${t("common.egp")}`
                            : `${t("invoice.total")}: ${invLegacy!.total} ${t("common.egp")}`}
                        </Text>
                      </View>
                      <VectorIcon name={invoiceExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>

                    {invoiceExpanded && (
                      <>
                        {inv3 ? (() => {
                          const sfRate = inv3.serviceFeeRate ?? DEFAULT_SERVICE_FEE_RATE;
                          const vRate = inv3.vatRate ?? DEFAULT_VAT_RATE;
                          return (
                          <>
                            {/* Technician Payout block */}
                            <View style={[styles.invoiceSectionHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
                              <View style={{ backgroundColor: colors.primary + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 11 }}>{isRTL ? "الفني" : "Technician"}</Text>
                              </View>
                              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
                                {isRTL ? "دفعة الفني" : "Technician Payout"}
                              </Text>
                            </View>
                            {[
                              [isRTL ? "تكلفة المواد" : "Materials Cost", inv3.materialsTotal],
                              inv3.transportFee > 0 ? [isRTL ? "تكلفة النقل" : "Transport", inv3.transportFee] : null,
                              [isRTL ? "أجر العمالة" : "Labour Fee", inv3.labourFee],
                              [isRTL ? `خصم رسوم الخدمة (${sfRate}%)` : `Service Fee Deduction (${sfRate}%)`, -inv3.serviceFeeAmount],
                            ].filter(Boolean).map((row) => {
                              const [label, val] = row as [string, number];
                              return (
                                <View key={label} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>{label}</Text>
                                  <Text style={{ color: val < 0 ? colors.destructive : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                                    {val < 0 ? `−${Math.abs(val).toFixed(2)}` : val.toFixed(2)} {t("common.egp")}
                                  </Text>
                                </View>
                              );
                            })}
                            <View style={[styles.invoiceSubTotal, { backgroundColor: colors.accent, borderRadius: 8, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>{isRTL ? "صافي استحقاق الفني" : "Technician Net"}</Text>
                              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{inv3.techNetTotal.toFixed(2)} {t("common.egp")}</Text>
                            </View>

                            {/* Client Invoice block */}
                            <View style={[styles.invoiceSectionHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border, marginTop: 10 }]}>
                              <View style={{ backgroundColor: colors.success + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ color: colors.success, fontFamily: "Inter_700Bold", fontSize: 11 }}>{isRTL ? "العميل" : "Client"}</Text>
                              </View>
                              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
                                {isRTL ? "فاتورة العميل" : "Client Invoice"}
                              </Text>
                            </View>
                            {[
                              [isRTL ? "تكلفة المواد" : "Materials Cost", inv3.materialsTotal],
                              inv3.transportFee > 0 ? [isRTL ? "تكلفة النقل" : "Transport", inv3.transportFee] : null,
                              [isRTL ? "أجر العمالة" : "Labour Fee", inv3.labourFee],
                              [isRTL ? `رسوم الخدمة (${sfRate}%)` : `Service Fee (${sfRate}%)`, inv3.serviceFeeAmount],
                              [isRTL ? `ضريبة القيمة المضافة (${vRate}%)` : `VAT (${vRate}%)`, inv3.vatAmount],
                            ].filter(Boolean).map((row) => {
                              const [label, val] = row as [string, number];
                              return (
                                <View key={label} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>{label}</Text>
                                  <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{(val as number).toFixed(2)} {t("common.egp")}</Text>
                                </View>
                              );
                            })}
                            <View style={[styles.invoiceSubTotal, { backgroundColor: colors.accent, borderRadius: 8, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>{isRTL ? "إجمالي العميل" : "Client Total"}</Text>
                              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{inv3.clientTotal.toFixed(2)} {t("common.egp")}</Text>
                            </View>

                            {/* Platform Ledger block */}
                            {inv3.adminTotal > 0 && (
                              <>
                                <View style={[styles.invoiceSectionHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border, marginTop: 10 }]}>
                                  <View style={{ backgroundColor: colors.secondary + "30", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                    <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold", fontSize: 11 }}>{isRTL ? "المنصة" : "Platform"}</Text>
                                  </View>
                                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
                                    {isRTL ? "حساب المنصة" : "Platform Ledger"}
                                  </Text>
                                </View>
                                {[
                                  [isRTL ? `رسوم الخدمة من الفني (${sfRate}%)` : `Service Fee from Tech (${sfRate}%)`, inv3.serviceFeeAmount],
                                  [isRTL ? `رسوم الخدمة من العميل (${sfRate}%)` : `Service Fee from Client (${sfRate}%)`, inv3.serviceFeeAmount],
                                  [isRTL ? `ضريبة القيمة المضافة (${vRate}%)` : `VAT Collected (${vRate}%)`, inv3.vatAmount],
                                ].map(([label, val]) => (
                                  <View key={label as string} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>{label as string}</Text>
                                    <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{(val as number).toFixed(2)} {t("common.egp")}</Text>
                                  </View>
                                ))}
                                <View style={[styles.invoiceSubTotal, { backgroundColor: colors.accent, borderRadius: 8, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>{isRTL ? "إجمالي المنصة" : "Platform Total"}</Text>
                                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{inv3.adminTotal.toFixed(2)} {t("common.egp")}</Text>
                                </View>
                              </>
                            )}
                          </>
                          );
                        })() : invLegacy ? (
                          <>
                            {/* Legacy invoice line items */}
                            {[
                              [t("invoice.materials"), invLegacy.materialsTotal],
                              [t("invoice.materialsMark"), invLegacy.materialsMark],
                              [t("invoice.labor"), invLegacy.laborFee],
                              [t("invoice.tools"), invLegacy.toolRental],
                              [t("invoice.tax"), invLegacy.tax],
                              [t("invoice.vat"), invLegacy.vat],
                            ].map(([label, val]) => (
                              <View key={label as string} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>{label as string}</Text>
                                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{val as number} {t("common.egp")}</Text>
                              </View>
                            ))}
                            <View style={[styles.invoiceSubTotal, { backgroundColor: colors.accent, borderRadius: 8, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>{t("invoice.total")}</Text>
                              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{invLegacy.total} {t("common.egp")}</Text>
                            </View>
                          </>
                        ) : null}
                      </>
                    )}
                  </View>
                )}
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
  filterRow: { paddingTop: 10 },
  filterList: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1.5 },
  list: { paddingHorizontal: 16 },
  card: { marginBottom: 10, borderWidth: 1.5, flexDirection: "row", overflow: "hidden" },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { alignItems: "center", marginBottom: 8, gap: 8 },
  subThumb: { width: 44, height: 44, borderWidth: 1 },
  cardMid: { alignItems: "center", marginBottom: 6, gap: 8 },
  cardFoot: { alignItems: "center", gap: 4 },
  totalChip: { paddingVertical: 6, paddingHorizontal: 12 },
  techContactRow: { alignItems: "center", marginTop: 8, borderTopWidth: 1, paddingTop: 8, gap: 0 },
  callBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  smsBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 80 },
  invoiceBlock: { marginTop: 10, borderWidth: 1 },
  invoiceToggleRow: { alignItems: "center", padding: 10, borderBottomWidth: 1, gap: 0 },
  invoiceLogo: { width: 28, height: 28, borderRadius: 6 },
  invoiceSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1 },
  invoiceRow: { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between" },
  invoiceSubTotal: { margin: 10, padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
