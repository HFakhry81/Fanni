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
  Clipboard,
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

interface PaymentConfig {
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  iban: string | null;
  instapayId: string | null;
  ewalletNumber: string | null;
  notes: string | null;
}

interface PaymentRequest {
  id: string;
  amount_egp: string;
  points_requested: number;
  payment_method: string;
  reference_number: string | null;
  status: "pending" | "confirmed" | "rejected";
  created_at: string;
}

const METHOD_OPTIONS = [
  { key: "bank_transfer", ar: "تحويل بنكي", en: "Bank Transfer", icon: "credit-card" },
  { key: "instapay", ar: "إنستا باي", en: "InstaPay", icon: "zap" },
  { key: "e_wallet", ar: "محفظة إلكترونية", en: "E-Wallet", icon: "smartphone" },
] as const;

export default function WalletScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [packages, setPackages] = useState<PointPackage[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [myRequests, setMyRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Payment modal state
  const [selectedPkg, setSelectedPkg] = useState<PointPackage | null>(null);
  const [modalStep, setModalStep] = useState<"account" | "reference">("account");
  const [payMethod, setPayMethod] = useState<"bank_transfer" | "instapay" | "e_wallet">("bank_transfer");
  const [reference, setReference] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const apiHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  }), [sessionToken]);

  const fetchData = useCallback(async (isRefresh = false) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [walletRes, pkgRes, configRes, requestsRes] = await Promise.all([
        fetch(`${apiBase}/api/wallet`, { headers: apiHeaders() }),
        fetch(`${apiBase}/api/wallet/packages`),
        fetch(`${apiBase}/api/payment-config`, { headers: apiHeaders() }),
        fetch(`${apiBase}/api/payments/my-requests`, { headers: apiHeaders() }),
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
      if (configRes.ok) {
        const json = await configRes.json() as { config: PaymentConfig | null };
        setPaymentConfig(json.config);
      }
      if (requestsRes.ok) {
        const json = await requestsRes.json() as { requests: PaymentRequest[] };
        setMyRequests(json.requests ?? []);
      }
    } catch (err) {
      console.warn("[Wallet] fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken, apiHeaders]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const openBuyModal = (pkg: PointPackage) => {
    setSelectedPkg(pkg);
    setModalStep("account");
    setPayMethod("bank_transfer");
    setReference("");
    setTransferNote("");
    setModalVisible(true);
  };

  const submitPaymentRequest = async () => {
    if (!selectedPkg) return;
    if (!reference.trim()) {
      Alert.alert(
        isRTL ? "مطلوب" : "Required",
        isRTL ? "يرجى إدخال رقم مرجع التحويل" : "Please enter the transfer reference number",
      );
      return;
    }
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    setSubmitLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/payments/request`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          packageId: selectedPkg.id,
          amountEgp: parseFloat(selectedPkg.priceEgp),
          pointsRequested: selectedPkg.pointsAmount,
          paymentMethod: payMethod,
          referenceNumber: reference.trim(),
          transferNote: transferNote.trim() || undefined,
        }),
      });
      if (res.ok) {
        setModalVisible(false);
        await fetchData(true);
        Alert.alert(
          isRTL ? "تم إرسال الطلب ✓" : "Request Submitted ✓",
          isRTL
            ? "سنضيف النقاط بعد مراجعة وتأكيد التحويل من قِبل الإدارة"
            : "We'll credit your points once admin verifies the transfer",
        );
      } else {
        const json = await res.json() as { error?: string };
        Alert.alert(isRTL ? "خطأ" : "Error", json.error ?? "Failed");
      }
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل الاتصال" : "Connection failed");
    } finally {
      setSubmitLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert(isRTL ? "تم النسخ" : "Copied", label);
  };

  const txLabel = (type: string) => t(`wallet.type.${type}`) || type;
  const txColor = (amt: number) => (amt > 0 ? "#22c55e" : "#ef4444");

  const statusColor = (s: string) =>
    s === "confirmed" ? "#22C55E" : s === "rejected" ? "#EF4444" : "#F59E0B";

  const statusLabel = (s: string) =>
    s === "confirmed"
      ? isRTL ? "مؤكد ✓" : "Confirmed ✓"
      : s === "rejected"
      ? isRTL ? "مرفوض ✗" : "Rejected ✗"
      : isRTL ? "قيد الانتظار…" : "Pending…";

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Balance Card ── */}
        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
          <VectorIcon name="credit-card" size={28} color="#fff" />
          <Text style={styles.balanceLabel}>{t("wallet.balance")}</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceAmount}>{balance.toLocaleString()}</Text>
            <Text style={styles.balancePtsLabel}>{t("wallet.points")}</Text>
          </View>
        </View>

        {/* ── How to buy (steps) ── */}
        <View
          style={[
            styles.howToCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.howToTitle,
              { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {t("payment.howTo")}
          </Text>
          {[
            t("payment.step1"),
            t("payment.step2"),
            t("payment.step3"),
            t("payment.step4"),
          ].map((step, i) => (
            <View
              key={i}
              style={[
                styles.stepRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[styles.stepNum, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text
                style={[
                  styles.stepText,
                  {
                    color: colors.foreground,
                    textAlign: isRTL ? "right" : "left",
                  },
                ]}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Packages ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
          ]}
        >
          {t("wallet.buyPoints")}
        </Text>
        <View
          style={[
            styles.packagesRow,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          {packages.map((pkg) => {
            const name = isRTL ? pkg.nameAr : pkg.nameEn;
            const price = parseFloat(pkg.priceEgp);
            const origPrice = pkg.originalPriceEgp
              ? parseFloat(pkg.originalPriceEgp)
              : null;
            const savePct =
              origPrice && origPrice > price
                ? Math.round((1 - price / origPrice) * 100)
                : null;
            return (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.pkgCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
                onPress={() => openBuyModal(pkg)}
              >
                {savePct ? (
                  <View
                    style={[styles.saveBadge, { backgroundColor: "#22c55e" }]}
                  >
                    <Text style={styles.saveBadgeText}>
                      {t("wallet.save")} {savePct}%
                    </Text>
                  </View>
                ) : null}
                <Text style={[styles.pkgPoints, { color: colors.primary }]}>
                  {pkg.pointsAmount.toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.pkgPtsLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {t("wallet.points")}
                </Text>
                <Text
                  style={[styles.pkgName, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {name}
                </Text>
                {origPrice ? (
                  <Text
                    style={[
                      styles.pkgOrigPrice,
                      { color: colors.mutedForeground },
                    ]}
                  >
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

        {/* ── Previous payment requests ── */}
        {myRequests.length > 0 && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.foreground,
                  textAlign: isRTL ? "right" : "left",
                },
              ]}
            >
              {t("payment.historyTitle")}
            </Text>
            {myRequests.slice(0, 5).map((req) => (
              <View
                key={req.id}
                style={[
                  styles.reqRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderLeftColor: statusColor(req.status),
                    flexDirection: isRTL ? "row-reverse" : "row",
                  },
                ]}
              >
                <View style={[styles.reqStripe, { backgroundColor: statusColor(req.status) }]} />
                <View style={{ flex: 1 }}>
                  <View
                    style={[
                      styles.reqHeader,
                      { flexDirection: isRTL ? "row-reverse" : "row" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.reqAmount,
                        { color: colors.primary },
                      ]}
                    >
                      {parseFloat(req.amount_egp).toFixed(0)} {t("wallet.egp")}
                    </Text>
                    <Text
                      style={[
                        styles.reqPts,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      → {req.points_requested.toLocaleString()} {t("wallet.points")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.reqStatus,
                      { color: statusColor(req.status), textAlign: isRTL ? "right" : "left" },
                    ]}
                  >
                    {statusLabel(req.status)}
                  </Text>
                  <Text
                    style={[
                      styles.reqDate,
                      { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" },
                    ]}
                  >
                    {new Date(req.created_at).toLocaleDateString(
                      isRTL ? "ar-EG" : "en-GB",
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── Transaction History ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
          ]}
        >
          {t("wallet.history")}
        </Text>
        {transactions.length === 0 ? (
          <View
            style={[
              styles.emptyTx,
              {
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                borderColor: colors.border,
              },
            ]}
          >
            <VectorIcon name="inbox" size={32} color={colors.mutedForeground} />
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                marginTop: 8,
              }}
            >
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
              <View
                style={[
                  styles.txIcon,
                  {
                    backgroundColor:
                      tx.pointsAmount > 0 ? "#dcfce7" : "#fee2e2",
                  },
                ]}
              >
                <VectorIcon
                  name={
                    tx.pointsAmount > 0 ? "arrow-down-left" : "arrow-up-right"
                  }
                  size={16}
                  color={txColor(tx.pointsAmount)}
                />
              </View>
              <View
                style={[
                  styles.txInfo,
                  { alignItems: isRTL ? "flex-end" : "flex-start" },
                ]}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                  }}
                >
                  {txLabel(tx.type)}
                </Text>
                {tx.description ? (
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      fontSize: 11,
                    }}
                    numberOfLines={1}
                  >
                    {tx.description}
                  </Text>
                ) : null}
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                  }}
                >
                  {new Date(tx.createdAt).toLocaleDateString(
                    isRTL ? "ar-EG" : "en-US",
                    { day: "numeric", month: "short" },
                  )}
                </Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  { color: txColor(tx.pointsAmount) },
                ]}
              >
                {tx.pointsAmount > 0 ? "+" : ""}
                {tx.pointsAmount} {t("wallet.points")}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Payment Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Header */}
            <View
              style={[
                styles.modalHeader,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <Text
                style={[
                  styles.modalTitle,
                  {
                    color: colors.foreground,
                    textAlign: isRTL ? "right" : "left",
                  },
                ]}
              >
                {modalStep === "account"
                  ? isRTL
                    ? "تفاصيل الدفع"
                    : "Payment Details"
                  : isRTL
                  ? "تأكيد التحويل"
                  : "Confirm Transfer"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <VectorIcon name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Package summary */}
            {selectedPkg && (
              <View
                style={[
                  styles.pkgSummary,
                  { backgroundColor: colors.accent, borderRadius: 10 },
                ]}
              >
                <Text
                  style={[
                    styles.pkgSummaryName,
                    { color: colors.primary },
                  ]}
                >
                  {isRTL ? selectedPkg.nameAr : selectedPkg.nameEn}
                </Text>
                <Text style={[styles.pkgSummaryDetail, { color: colors.foreground }]}>
                  {selectedPkg.pointsAmount.toLocaleString()} {t("wallet.points")} —{" "}
                  {parseFloat(selectedPkg.priceEgp).toFixed(0)} {t("wallet.egp")}
                </Text>
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 420 }}
            >
              {modalStep === "account" ? (
                <>
                  {/* Payment method selector */}
                  <Text
                    style={[
                      styles.fieldLabel,
                      {
                        color: colors.mutedForeground,
                        textAlign: isRTL ? "right" : "left",
                      },
                    ]}
                  >
                    {isRTL ? "وسيلة الدفع" : "Payment Method"}
                  </Text>
                  <View
                    style={[
                      styles.methodRow,
                      { flexDirection: isRTL ? "row-reverse" : "row" },
                    ]}
                  >
                    {METHOD_OPTIONS.map((m) => (
                      <TouchableOpacity
                        key={m.key}
                        style={[
                          styles.methodChip,
                          {
                            borderColor:
                              payMethod === m.key
                                ? colors.primary
                                : colors.border,
                            backgroundColor:
                              payMethod === m.key
                                ? colors.primary + "18"
                                : colors.background,
                          },
                        ]}
                        onPress={() => setPayMethod(m.key)}
                      >
                        <VectorIcon
                          name={m.icon as never}
                          size={14}
                          color={
                            payMethod === m.key
                              ? colors.primary
                              : colors.mutedForeground
                          }
                        />
                        <Text
                          style={[
                            styles.methodText,
                            {
                              color:
                                payMethod === m.key
                                  ? colors.primary
                                  : colors.mutedForeground,
                            },
                          ]}
                        >
                          {isRTL ? m.ar : m.en}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Account details */}
                  {paymentConfig && (
                    <View
                      style={[
                        styles.accountCard,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {paymentConfig.bankName && (
                        <AccountRow
                          label={isRTL ? "البنك" : "Bank"}
                          value={paymentConfig.bankName}
                          colors={colors}
                          isRTL={isRTL}
                          onCopy={copyToClipboard}
                        />
                      )}
                      {paymentConfig.accountName && (
                        <AccountRow
                          label={isRTL ? "اسم الحساب" : "Account Name"}
                          value={paymentConfig.accountName}
                          colors={colors}
                          isRTL={isRTL}
                          onCopy={copyToClipboard}
                        />
                      )}
                      {paymentConfig.accountNumber && payMethod === "bank_transfer" && (
                        <AccountRow
                          label={isRTL ? "رقم الحساب" : "Account No."}
                          value={paymentConfig.accountNumber}
                          colors={colors}
                          isRTL={isRTL}
                          onCopy={copyToClipboard}
                        />
                      )}
                      {paymentConfig.iban && payMethod === "bank_transfer" && (
                        <AccountRow
                          label="IBAN"
                          value={paymentConfig.iban}
                          colors={colors}
                          isRTL={isRTL}
                          onCopy={copyToClipboard}
                        />
                      )}
                      {paymentConfig.instapayId && payMethod === "instapay" && (
                        <AccountRow
                          label={isRTL ? "رقم إنستا باي" : "InstaPay ID"}
                          value={paymentConfig.instapayId}
                          colors={colors}
                          isRTL={isRTL}
                          onCopy={copyToClipboard}
                        />
                      )}
                      {paymentConfig.ewalletNumber && payMethod === "e_wallet" && (
                        <AccountRow
                          label={isRTL ? "رقم المحفظة" : "Wallet No."}
                          value={paymentConfig.ewalletNumber}
                          colors={colors}
                          isRTL={isRTL}
                          onCopy={copyToClipboard}
                        />
                      )}
                      {paymentConfig.notes && (
                        <Text
                          style={[
                            styles.configNote,
                            {
                              color: colors.mutedForeground,
                              textAlign: isRTL ? "right" : "left",
                            },
                          ]}
                        >
                          ℹ️ {paymentConfig.notes}
                        </Text>
                      )}
                    </View>
                  )}

                  <FanniButton
                    title={
                      isRTL
                        ? "التالي: أدخل رقم المرجع"
                        : "Next: Enter Reference"
                    }
                    onPress={() => setModalStep("reference")}
                    style={{ marginTop: 14 }}
                  />
                </>
              ) : (
                <>
                  {/* Reference input */}
                  <Text
                    style={[
                      styles.fieldLabel,
                      {
                        color: colors.mutedForeground,
                        textAlign: isRTL ? "right" : "left",
                      },
                    ]}
                  >
                    {t("payment.reference")} *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        textAlign: isRTL ? "right" : "left",
                      },
                    ]}
                    placeholder={
                      isRTL
                        ? "مثال: 202507231234"
                        : "e.g. 202507231234"
                    }
                    placeholderTextColor={colors.mutedForeground}
                    value={reference}
                    onChangeText={setReference}
                    keyboardType="default"
                  />

                  <Text
                    style={[
                      styles.fieldLabel,
                      {
                        color: colors.mutedForeground,
                        textAlign: isRTL ? "right" : "left",
                        marginTop: 12,
                      },
                    ]}
                  >
                    {t("payment.note")}
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.textArea,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        textAlign: isRTL ? "right" : "left",
                      },
                    ]}
                    placeholder={
                      isRTL
                        ? "أي ملاحظات إضافية للإدارة"
                        : "Any additional notes for admin"
                    }
                    placeholderTextColor={colors.mutedForeground}
                    value={transferNote}
                    onChangeText={setTransferNote}
                    multiline
                    numberOfLines={3}
                  />

                  <TouchableOpacity
                    style={{ alignItems: isRTL ? "flex-end" : "flex-start", marginBottom: 4 }}
                    onPress={() => setModalStep("account")}
                  >
                    <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                      ← {isRTL ? "رجوع" : "Back"}
                    </Text>
                  </TouchableOpacity>

                  <FanniButton
                    title={
                      isRTL
                        ? "إرسال طلب الدفع"
                        : "Submit Payment Request"
                    }
                    onPress={submitPaymentRequest}
                    loading={submitLoading}
                    style={{ marginTop: 8 }}
                  />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Account detail row ────────────────────────────────────────────────────────
function AccountRow({
  label,
  value,
  colors,
  isRTL,
  onCopy,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  isRTL: boolean;
  onCopy: (v: string, l: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.accountRow,
        { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border },
      ]}
      onPress={() => onCopy(value, label)}
      activeOpacity={0.7}
    >
      <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          styles.accountValue,
          { color: colors.foreground, textAlign: isRTL ? "left" : "right" },
        ]}
        selectable
      >
        {value}
      </Text>
      <VectorIcon name="copy" size={13} color={colors.mutedForeground} style={{ marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 100 },
  balanceCard: {
    borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 20, gap: 8,
  },
  balanceLabel: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 14, opacity: 0.85 },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  balanceAmount: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 42 },
  balancePtsLabel: { color: "#fff", fontFamily: "Inter_400Regular", fontSize: 16, opacity: 0.8 },
  howToCard: {
    borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 20, gap: 8,
  },
  howToTitle: { fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 4 },
  stepRow: { alignItems: "flex-start", gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 11 },
  stepText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 12, marginTop: 4 },
  packagesRow: { gap: 10, marginBottom: 24, flexWrap: "wrap" },
  pkgCard: {
    flex: 1, minWidth: 90, padding: 12, alignItems: "center",
    borderWidth: 1, overflow: "visible", position: "relative",
  },
  saveBadge: { position: "absolute", top: -8, right: -8, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  saveBadgeText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 9 },
  pkgPoints: { fontFamily: "Inter_700Bold", fontSize: 24 },
  pkgPtsLabel: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  pkgName: { fontFamily: "Inter_500Medium", fontSize: 11, textAlign: "center", marginTop: 6 },
  pkgOrigPrice: { fontFamily: "Inter_400Regular", fontSize: 11, textDecorationLine: "line-through", marginTop: 4 },
  pkgPrice: { fontFamily: "Inter_700Bold", fontSize: 14, marginTop: 2 },
  reqRow: {
    borderRadius: 10, borderWidth: 1, marginBottom: 8, overflow: "hidden",
    paddingRight: 12, paddingVertical: 10,
  },
  reqStripe: { width: 4, marginRight: 10 },
  reqHeader: { alignItems: "center", gap: 6, marginBottom: 2 },
  reqAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
  reqPts: { fontFamily: "Inter_500Medium", fontSize: 12 },
  reqStatus: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginBottom: 2 },
  reqDate: { fontFamily: "Inter_400Regular", fontSize: 11, opacity: 0.7 },
  emptyTx: { padding: 32, alignItems: "center", borderWidth: 1 },
  txRow: { padding: 12, borderWidth: 1, marginBottom: 8, alignItems: "center", gap: 10 },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1, gap: 2 },
  txAmount: { fontFamily: "Inter_700Bold", fontSize: 13 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalBox: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, padding: 20, paddingBottom: 40, gap: 12,
    maxHeight: "90%",
  },
  modalHeader: { justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  pkgSummary: { padding: 12, gap: 4 },
  pkgSummaryName: { fontFamily: "Inter_700Bold", fontSize: 15 },
  pkgSummaryDetail: { fontFamily: "Inter_500Medium", fontSize: 13 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 },
  methodRow: { gap: 8, marginBottom: 14, flexWrap: "wrap" },
  methodChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
  },
  methodText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  accountCard: { borderRadius: 10, borderWidth: 1, overflow: "hidden", marginBottom: 6 },
  accountRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accountLabel: { fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 },
  accountValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 2 },
  configNote: { fontFamily: "Inter_400Regular", fontSize: 11, padding: 10, paddingTop: 6 },
  textInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: "Inter_400Regular", fontSize: 14,
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
});
