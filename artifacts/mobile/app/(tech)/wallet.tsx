import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import VectorIcon from "@/components/VectorIcon";
import AppHeader from "@/components/AppHeader";
import FanniButton from "@/components/FanniButton";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/utils/api";

interface PointPackage {
  id: string;
  nameEn: string;
  nameAr: string;
  pointsAmount: number;
  priceEgp: string;
  originalPriceEgp: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface WalletTx {
  id: string;
  pointsAmount: number;
  type: string;
  cashAmountPaid: string;
  description: string | null;
  createdAt: string;
}

interface Wallet {
  id: string;
  pointsBalance: number;
  updatedAt: string;
}

export default function WalletScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [packages, setPackages] = useState<PointPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<PointPackage | null>(null);
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [walletRes, pkgRes] = await Promise.all([
        fetch(`${apiBase}/api/wallet`, { headers: { Authorization: `Bearer ${sessionToken}` } }),
        fetch(`${apiBase}/api/wallet/packages`),
      ]);
      if (walletRes.ok) {
        const json = await walletRes.json() as { wallet: Wallet; transactions: WalletTx[] };
        setWallet(json.wallet);
        setTransactions(json.transactions ?? []);
      }
      if (pkgRes.ok) {
        const json = await pkgRes.json() as { packages: PointPackage[] };
        setPackages(json.packages ?? []);
      }
    } catch (err) {
      console.warn("[Wallet] fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handleBuy = useCallback(async () => {
    if (!selectedPkg) return;
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    setBuyLoading(true);
    try {
      // In production this would redirect to a payment gateway.
      // For demo/dev, we simulate a completed purchase.
      const res = await fetch(`${apiBase}/api/admin/wallet/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          technicianId: undefined,
          pointsAmount: selectedPkg.pointsAmount,
          description: `Package purchase: ${selectedPkg.nameEn}`,
        }),
      });
      if (res.ok) {
        setBuyModalVisible(false);
        setSelectedPkg(null);
        await fetchData(true);
        Alert.alert(
          isRTL ? "تم الشراء" : "Purchase Complete",
          isRTL
            ? `تم إضافة ${selectedPkg.pointsAmount} نقطة إلى رصيدك`
            : `${selectedPkg.pointsAmount} points added to your balance`,
        );
      } else {
        const json = await res.json() as { error?: string };
        Alert.alert(isRTL ? "خطأ" : "Error", json.error ?? "Purchase failed");
      }
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل الاتصال" : "Connection failed");
    } finally {
      setBuyLoading(false);
    }
  }, [selectedPkg, sessionToken, isRTL, fetchData]);

  const txLabel = (type: string) => t(`wallet.type.${type}`) || type;

  const txColor = (amt: number) => amt > 0 ? "#22c55e" : "#ef4444";

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={t("wallet.title")} showLangToggle />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const balance = wallet?.pointsBalance ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("wallet.title")} showLangToggle />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
          <VectorIcon name="credit-card" size={28} color="#fff" />
          <Text style={styles.balanceLabel}>{t("wallet.balance")}</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceAmount}>{balance.toLocaleString()}</Text>
            <Text style={styles.balancePtsLabel}>{t("wallet.points")}</Text>
          </View>
        </View>

        {/* Buy Points */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {t("wallet.buyPoints")}
        </Text>
        <View style={[styles.packagesRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {packages.map((pkg) => {
            const name = isRTL ? pkg.nameAr : pkg.nameEn;
            const price = parseFloat(pkg.priceEgp);
            const origPrice = pkg.originalPriceEgp ? parseFloat(pkg.originalPriceEgp) : null;
            const savePct = origPrice && origPrice > price ? Math.round((1 - price / origPrice) * 100) : null;
            return (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.pkgCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: selectedPkg?.id === pkg.id ? colors.primary : colors.border,
                    borderWidth: selectedPkg?.id === pkg.id ? 2 : 1,
                    borderRadius: colors.radius,
                  },
                ]}
                onPress={() => { setSelectedPkg(pkg); setBuyModalVisible(true); }}
              >
                {savePct ? (
                  <View style={[styles.saveBadge, { backgroundColor: "#22c55e" }]}>
                    <Text style={styles.saveBadgeText}>{t("wallet.save")} {savePct}%</Text>
                  </View>
                ) : null}
                <Text style={[styles.pkgPoints, { color: colors.primary }]}>
                  {pkg.pointsAmount.toLocaleString()}
                </Text>
                <Text style={[styles.pkgPtsLabel, { color: colors.mutedForeground }]}>{t("wallet.points")}</Text>
                <Text style={[styles.pkgName, { color: colors.foreground }]} numberOfLines={2}>{name}</Text>
                {origPrice ? (
                  <Text style={[styles.pkgOrigPrice, { color: colors.mutedForeground }]}>
                    {origPrice.toFixed(0)} {t("wallet.egp")}
                  </Text>
                ) : null}
                <Text style={[styles.pkgPrice, { color: colors.foreground }]}>
                  {price.toFixed(0)} {t("wallet.egp")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Transaction History */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {t("wallet.history")}
        </Text>
        {transactions.length === 0 ? (
          <View style={[styles.emptyTx, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <VectorIcon name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8 }}>
              {t("wallet.noHistory")}
            </Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <View
              key={tx.id}
              style={[
                styles.txRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  flexDirection: isRTL ? "row-reverse" : "row",
                },
              ]}
            >
              <View style={[styles.txIcon, { backgroundColor: tx.pointsAmount > 0 ? "#dcfce7" : "#fee2e2" }]}>
                <VectorIcon
                  name={tx.pointsAmount > 0 ? "arrow-down-left" : "arrow-up-right"}
                  size={16}
                  color={txColor(tx.pointsAmount)}
                />
              </View>
              <View style={[styles.txInfo, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {txLabel(tx.type)}
                </Text>
                {tx.description ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }} numberOfLines={1}>
                    {tx.description}
                  </Text>
                ) : null}
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                  {new Date(tx.createdAt).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { day: "numeric", month: "short" })}
                </Text>
              </View>
              <Text style={[styles.txAmount, { color: txColor(tx.pointsAmount) }]}>
                {tx.pointsAmount > 0 ? "+" : ""}{tx.pointsAmount} {t("wallet.points")}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Buy Confirmation Modal */}
      <Modal visible={buyModalVisible} transparent animationType="slide" onRequestClose={() => setBuyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            {selectedPkg && (
              <>
                <Text style={[styles.modalTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                  {isRTL ? selectedPkg.nameAr : selectedPkg.nameEn}
                </Text>
                <View style={[styles.modalDetail, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }}>
                    {isRTL ? "النقاط:" : "Points:"}
                  </Text>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 22, marginHorizontal: 8 }}>
                    {selectedPkg.pointsAmount.toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.modalDetail, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }}>
                    {isRTL ? "السعر:" : "Price:"}
                  </Text>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18, marginHorizontal: 8 }}>
                    {parseFloat(selectedPkg.priceEgp).toFixed(0)} {t("wallet.egp")}
                  </Text>
                </View>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 16, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL
                    ? "سيتم خصم المبلغ عبر بوابة الدفع الآمنة"
                    : "Amount will be charged via secure payment gateway"}
                </Text>
                <FanniButton
                  title={isRTL ? `شراء — ${parseFloat(selectedPkg.priceEgp).toFixed(0)} ج.م` : `Buy — ${parseFloat(selectedPkg.priceEgp).toFixed(0)} EGP`}
                  onPress={handleBuy}
                  loading={buyLoading}
                  style={{ marginBottom: 10 }}
                />
                <TouchableOpacity onPress={() => setBuyModalVisible(false)} style={{ alignItems: "center", paddingVertical: 8 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                    {isRTL ? "إلغاء" : "Cancel"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 100 },
  balanceCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  balanceLabel: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 14, opacity: 0.85 },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  balanceAmount: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 42 },
  balancePtsLabel: { color: "#fff", fontFamily: "Inter_400Regular", fontSize: 16, opacity: 0.8 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 12 },
  packagesRow: { gap: 10, marginBottom: 24, flexWrap: "wrap" },
  pkgCard: {
    flex: 1,
    minWidth: 90,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    overflow: "visible",
    position: "relative",
  },
  saveBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saveBadgeText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 9 },
  pkgPoints: { fontFamily: "Inter_700Bold", fontSize: 24 },
  pkgPtsLabel: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  pkgName: { fontFamily: "Inter_500Medium", fontSize: 11, textAlign: "center", marginTop: 6 },
  pkgOrigPrice: { fontFamily: "Inter_400Regular", fontSize: 11, textDecorationLine: "line-through", marginTop: 4 },
  pkgPrice: { fontFamily: "Inter_700Bold", fontSize: 14, marginTop: 2 },
  emptyTx: { padding: 32, alignItems: "center", borderWidth: 1 },
  txRow: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: "center",
    gap: 10,
  },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1, gap: 2 },
  txAmount: { fontFamily: "Inter_700Bold", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { padding: 24, gap: 8, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 8 },
  modalDetail: { alignItems: "center", marginBottom: 4 },
});
