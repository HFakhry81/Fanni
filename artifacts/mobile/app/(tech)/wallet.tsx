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

// ─── Types ────────────────────────────────────────────────────────────────────
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

/** All keys are camelCase — matching Drizzle ORM output */
interface PaymentRequest {
  id: string;
  amountEgp: string;
  pointsRequested: number;
  paymentMethod: "bank_transfer" | "instapay" | "e_wallet";
  referenceNumber: string | null;
  transferNote: string | null;
  senderDetails: Record<string, string> | null;
  status: "pending" | "confirmed" | "rejected";
  adminNotes: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

interface AppNotification {
  id: string;
  type: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string | null;
  bodyEn: string | null;
  createdAt: string;
}

const METHODS = [
  { key: "bank_transfer" as const, ar: "تحويل بنكي", en: "Bank Transfer", icon: "credit-card" as const },
  { key: "instapay" as const, ar: "إنستا باي", en: "InstaPay", icon: "zap" as const },
  { key: "e_wallet" as const, ar: "محفظة إلكترونية", en: "E-Wallet", icon: "smartphone" as const },
];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WalletScreen() {
  const colors = useColors();
  const { isRTL } = useApp();
  const { sessionToken } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [packages, setPackages] = useState<PointPackage[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [myRequests, setMyRequests] = useState<PaymentRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [selectedPkg, setSelectedPkg] = useState<PointPackage | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  /** Step 1: choose method. Step 2: enter sender account. Step 3: review & confirm */
  const [modalStep, setModalStep] = useState<"method" | "sender" | "review">("method");
  const [payMethod, setPayMethod] = useState<"bank_transfer" | "instapay" | "e_wallet">("bank_transfer");
  const [senderAccount, setSenderAccount] = useState(""); // the tech's OWN account/id/number
  const [senderName, setSenderName] = useState("");        // optional sender name for bank
  const [submitLoading, setSubmitLoading] = useState(false);

  // Notifications modal
  const [notifVisible, setNotifVisible] = useState(false);

  const apiHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  }), [sessionToken]);

  const fetchData = useCallback(async (isRefresh = false) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [walletRes, pkgRes, configRes, requestsRes, notifRes] = await Promise.all([
        fetch(`${apiBase}/api/wallet`, { headers: apiHeaders() }),
        fetch(`${apiBase}/api/wallet/packages`),
        fetch(`${apiBase}/api/payment-config`, { headers: apiHeaders() }),
        fetch(`${apiBase}/api/payments/my-requests`, { headers: apiHeaders() }),
        fetch(`${apiBase}/api/notifications`, { headers: apiHeaders() }),
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
        // Drizzle returns camelCase keys
        const json = await requestsRes.json() as { requests: PaymentRequest[] };
        setMyRequests(Array.isArray(json.requests) ? json.requests : []);
      }
      if (notifRes.ok) {
        const json = await notifRes.json() as { notifications: AppNotification[] };
        setNotifications(Array.isArray(json.notifications) ? json.notifications : []);
      }
    } catch (err) {
      console.warn("[Wallet] fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken, apiHeaders]);

  useFocusEffect(useCallback(() => { void fetchData(); }, [fetchData]));

  // ─── Dismiss notification ──────────────────────────────────────────────────
  const dismissNotification = async (id: string) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    try {
      await fetch(`${apiBase}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: apiHeaders(),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const dismissAllNotifications = async () => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    try {
      await fetch(`${apiBase}/api/notifications/read-all`, {
        method: "PATCH",
        headers: apiHeaders(),
      });
      setNotifications([]);
      setNotifVisible(false);
    } catch {}
  };

  // ─── Open buy modal ────────────────────────────────────────────────────────
  const openBuyModal = (pkg: PointPackage) => {
    setSelectedPkg(pkg);
    setModalStep("method");
    setPayMethod("bank_transfer");
    setSenderAccount("");
    setSenderName("");
    setModalVisible(true);
  };

  // ─── Submit payment request ────────────────────────────────────────────────
  const submitPaymentRequest = async () => {
    if (!selectedPkg) return;
    const senderKey = payMethod === "bank_transfer"
      ? "accountNumber"
      : payMethod === "instapay"
      ? "instapayId"
      : "walletNumber";

    if (!senderAccount.trim()) {
      Alert.alert(
        isRTL ? "مطلوب" : "Required",
        isRTL
          ? "يرجى إدخال بيانات حسابك"
          : "Please enter your account details",
      );
      return;
    }
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    setSubmitLoading(true);
    try {
      const senderDetails: Record<string, string> = { [senderKey]: senderAccount.trim() };
      if (senderName.trim()) senderDetails.accountName = senderName.trim();

      const res = await fetch(`${apiBase}/api/payments/request`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          packageId: selectedPkg.id,
          amountEgp: parseFloat(selectedPkg.priceEgp),
          pointsRequested: selectedPkg.pointsAmount,
          paymentMethod: payMethod,
          senderDetails,
        }),
      });
      if (res.ok) {
        setModalVisible(false);
        await fetchData(true);
        Alert.alert(
          isRTL ? "📨 تم إرسال الطلب" : "📨 Request Submitted",
          isRTL
            ? `طلبك لإضافة ${selectedPkg.pointsAmount} نقطة قيد المراجعة. سيتم إشعارك فور تأكيد الدفع.`
            : `Your request for ${selectedPkg.pointsAmount} pts is under review. You'll be notified once confirmed.`,
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

  // ─── Copy to clipboard ─────────────────────────────────────────────────────
  const copy = (text: string) => {
    Clipboard.setString(text);
    Alert.alert(isRTL ? "تم النسخ ✓" : "Copied ✓", text);
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const txLabel = (type: string): string => {
    const map: Record<string, { ar: string; en: string }> = {
      package_purchase: { ar: "شراء حزمة", en: "Package Purchase" },
      lead_unlock: { ar: "فتح طلب", en: "Lead Unlock" },
      dispute_refund: { ar: "استرداد نزاع", en: "Dispute Refund" },
      admin_adjustment: { ar: "تعديل إداري", en: "Admin Adjustment" },
      welcome_bonus: { ar: "مكافأة ترحيبية", en: "Welcome Bonus" },
    };
    return isRTL ? (map[type]?.ar ?? type) : (map[type]?.en ?? type);
  };

  const txColor = (amt: number) => (amt > 0 ? "#22c55e" : "#ef4444");

  const statusColor = (s: string) =>
    s === "confirmed" ? "#22C55E" : s === "rejected" ? "#EF4444" : "#F59E0B";

  const statusLabel = (s: string) =>
    s === "confirmed"
      ? isRTL ? "مؤكد ✓" : "Confirmed ✓"
      : s === "rejected"
      ? isRTL ? "مرفوض ✗" : "Rejected ✗"
      : isRTL ? "⏳ في انتظار التأكيد" : "⏳ Pending";

  const senderLabel = () => {
    if (payMethod === "bank_transfer") return isRTL ? "رقم حسابك البنكي" : "Your Bank Account Number";
    if (payMethod === "instapay")     return isRTL ? "رقم إنستا باي الخاص بك" : "Your InstaPay ID";
    return isRTL ? "رقم محفظتك الإلكترونية" : "Your E-Wallet Number";
  };

  const companyAccountValue = () => {
    if (!paymentConfig) return null;
    if (payMethod === "bank_transfer") return paymentConfig.accountNumber;
    if (payMethod === "instapay")      return paymentConfig.instapayId;
    return paymentConfig.ewalletNumber;
  };

  const methodLabel = (m: string) =>
    METHODS.find((x) => x.key === m)?.[isRTL ? "ar" : "en"] ?? m;

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={isRTL ? "محفظة النقاط" : "Points Wallet"} showLangToggle />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const balance = wallet?.pointsBalance ?? 0;
  const unreadCount = notifications.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={isRTL ? "محفظة النقاط" : "Points Wallet"} showLangToggle />

      {/* Notifications bell */}
      {unreadCount > 0 && (
        <TouchableOpacity
          style={[styles.notifBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
          onPress={() => setNotifVisible(true)}
          activeOpacity={0.8}
        >
          <VectorIcon name="bell" size={16} color={colors.primary} />
          <Text style={[styles.notifBannerText, { color: colors.primary }]}>
            {isRTL
              ? `لديك ${unreadCount} ${unreadCount === 1 ? "إشعار" : "إشعارات"} جديدة`
              : `You have ${unreadCount} new notification${unreadCount !== 1 ? "s" : ""}`}
          </Text>
          <VectorIcon name="chevron-right" size={14} color={colors.primary} />
        </TouchableOpacity>
      )}

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
          <Text style={styles.balanceLabel}>{isRTL ? "رصيدك الحالي" : "Your Balance"}</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceAmount}>{balance.toLocaleString()}</Text>
            <Text style={styles.balancePtsLabel}>{isRTL ? "نقطة" : "pts"}</Text>
          </View>
        </View>

        {/* ── How it works ── */}
        <View style={[styles.howToCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.howToTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "كيفية شراء النقاط" : "How to buy points"}
          </Text>
          {[
            isRTL ? "اختر الباقة المناسبة واضغط عليها" : "Pick a package and tap it",
            isRTL ? "اختر وسيلة الدفع وأدخل بيانات حسابك أنت" : "Choose a payment method and enter YOUR account details",
            isRTL ? "أرسل الطلب — سيراجعه المسئول" : "Submit — admin will review your request",
            isRTL ? "تُضاف النقاط فور تأكيد الدفع وستصلك إشعار" : "Points credited on confirmation + you'll get a notification",
          ].map((step, i) => (
            <View key={i} style={[styles.stepRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Packages ── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "الباقات المتاحة" : "Available Packages"}
        </Text>

        {packages.filter((p) => p.isActive).map((pkg) => {
          const name = isRTL ? pkg.nameAr : pkg.nameEn;
          const price = parseFloat(pkg.priceEgp);
          const origPrice = pkg.originalPriceEgp ? parseFloat(pkg.originalPriceEgp) : null;
          const discount = origPrice ? Math.round((1 - price / origPrice) * 100) : null;
          return (
            <TouchableOpacity
              key={pkg.id}
              style={[styles.pkgCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => openBuyModal(pkg)}
              activeOpacity={0.85}
            >
              <View style={[styles.pkgLeft, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={[styles.pkgPtsBadge, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[styles.pkgPtsNum, { color: colors.primary }]}>{pkg.pointsAmount}</Text>
                  <Text style={[styles.pkgPtsLabel, { color: colors.primary }]}>{isRTL ? "نقطة" : "pts"}</Text>
                </View>
                <View style={styles.pkgInfo}>
                  <Text style={[styles.pkgName, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {name}
                  </Text>
                  {origPrice && (
                    <Text style={[styles.pkgOrigPrice, { color: colors.mutedForeground }]}>
                      {origPrice.toFixed(0)} {isRTL ? "ج.م" : "EGP"}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.pkgRight}>
                {discount && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>-{discount}%</Text>
                  </View>
                )}
                <Text style={[styles.pkgPrice, { color: colors.primary }]}>
                  {price.toFixed(0)} {isRTL ? "ج.م" : "EGP"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Payment Requests History ── */}
        {myRequests.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left", marginTop: 20 }]}>
              {isRTL ? "طلبات الدفع السابقة" : "Previous Requests"}
            </Text>
            {myRequests.slice(0, 10).map((req) => {
              const sc = statusColor(req.status);
              return (
                <View
                  key={req.id}
                  style={[
                    styles.reqRow,
                    { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" },
                  ]}
                >
                  <View style={[styles.reqStripe, { backgroundColor: sc }]} />
                  <View style={{ flex: 1, paddingVertical: 2 }}>
                    <View style={[styles.reqHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                      <Text style={[styles.reqAmount, { color: colors.primary }]}>
                        {parseFloat(req.amountEgp).toFixed(0)} {isRTL ? "ج.م" : "EGP"}
                      </Text>
                      <Text style={[styles.reqPts, { color: colors.mutedForeground }]}>
                        → {req.pointsRequested} {isRTL ? "نقطة" : "pts"}
                      </Text>
                    </View>
                    <Text style={[styles.reqStatus, { color: sc }]}>{statusLabel(req.status)}</Text>
                    <Text style={[styles.reqMethod, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                      {methodLabel(req.paymentMethod)}
                    </Text>
                    {req.adminNotes ? (
                      <Text style={[styles.reqNote, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]} numberOfLines={2}>
                        {isRTL ? "ملاحظة: " : "Note: "}{req.adminNotes}
                      </Text>
                    ) : null}
                    <Text style={[styles.reqDate, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                      {new Date(req.createdAt).toLocaleString(isRTL ? "ar-EG" : "en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── Transaction History ── */}
        {transactions.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left", marginTop: 20 }]}>
              {isRTL ? "سجل المعاملات" : "Transaction History"}
            </Text>
            {transactions.slice(0, 20).map((tx) => (
              <View
                key={tx.id}
                style={[
                  styles.txRow,
                  { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
                <View style={[styles.txIcon, { backgroundColor: txColor(tx.pointsAmount) + "18" }]}>
                  <VectorIcon
                    name={tx.pointsAmount > 0 ? "arrow-down-left" : "arrow-up-right"}
                    size={16}
                    color={txColor(tx.pointsAmount)}
                  />
                </View>
                <View style={[styles.txInfo, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
                  <Text style={[styles.txLabel, { color: colors.foreground }]}>{txLabel(tx.type)}</Text>
                  {tx.description ? (
                    <Text style={[styles.txDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {tx.description}
                    </Text>
                  ) : null}
                  <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                    {new Date(tx.createdAt).toLocaleDateString(isRTL ? "ar-EG" : "en-GB")}
                  </Text>
                </View>
                <Text style={[styles.txAmount, { color: txColor(tx.pointsAmount) }]}>
                  {tx.pointsAmount > 0 ? "+" : ""}{tx.pointsAmount} {isRTL ? "ن" : "pt"}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ════════════════════════════════════════════════════════════════════
          BUY MODAL — 3 steps
       ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {modalStep === "method"
                  ? isRTL ? "اختر وسيلة الدفع" : "Choose Payment Method"
                  : modalStep === "sender"
                  ? isRTL ? "بيانات حسابك" : "Your Account Details"
                  : isRTL ? "مراجعة وتأكيد" : "Review & Confirm"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <VectorIcon name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Package summary pill */}
            {selectedPkg && (
              <View style={[styles.pkgSummary, { backgroundColor: colors.primary + "12", borderRadius: 10 }]}>
                <Text style={[styles.pkgSummaryName, { color: colors.primary, textAlign: isRTL ? "right" : "left" }]}>
                  {isRTL ? selectedPkg.nameAr : selectedPkg.nameEn}
                </Text>
                <Text style={[styles.pkgSummaryDetail, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                  {selectedPkg.pointsAmount} {isRTL ? "نقطة" : "pts"}
                  {"  "}·{"  "}
                  {parseFloat(selectedPkg.priceEgp).toFixed(0)} {isRTL ? "ج.م" : "EGP"}
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ── STEP 1: Method ── */}
              {modalStep === "method" && (
                <View style={{ gap: 10, marginTop: 8 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                    {isRTL ? "اختر الطريقة التي ستدفع بها" : "How would you like to pay?"}
                  </Text>
                  {METHODS.map((m) => (
                    <TouchableOpacity
                      key={m.key}
                      style={[
                        styles.methodCard,
                        {
                          borderColor: payMethod === m.key ? colors.primary : colors.border,
                          backgroundColor: payMethod === m.key ? colors.primary + "10" : colors.background,
                          flexDirection: isRTL ? "row-reverse" : "row",
                        },
                      ]}
                      onPress={() => setPayMethod(m.key)}
                      activeOpacity={0.85}
                    >
                      <VectorIcon name={m.icon} size={20} color={payMethod === m.key ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.methodCardText, { color: payMethod === m.key ? colors.primary : colors.foreground }]}>
                        {isRTL ? m.ar : m.en}
                      </Text>
                      {payMethod === m.key && (
                        <VectorIcon name="check-circle" size={18} color={colors.primary} style={{ marginLeft: "auto" }} />
                      )}
                    </TouchableOpacity>
                  ))}
                  <FanniButton
                    title={isRTL ? "التالي →" : "Next →"}
                    onPress={() => setModalStep("sender")}
                    style={{ marginTop: 8 }}
                  />
                </View>
              )}

              {/* ── STEP 2: Sender account ── */}
              {modalStep === "sender" && (
                <View style={{ gap: 12, marginTop: 8 }}>
                  {/* Company account (where to send) */}
                  {paymentConfig && (
                    <View style={[styles.accountCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <Text style={[styles.accountCardTitle, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                        {isRTL ? "📋 حوّل المبلغ إلى" : "📋 Transfer to"}
                      </Text>
                      {paymentConfig.bankName && payMethod === "bank_transfer" ? (
                        <CopyRow label={isRTL ? "البنك" : "Bank"} value={paymentConfig.bankName} onCopy={copy} isRTL={isRTL} colors={colors} />
                      ) : null}
                      {paymentConfig.accountName && payMethod === "bank_transfer" ? (
                        <CopyRow label={isRTL ? "الحساب" : "Account"} value={paymentConfig.accountName} onCopy={copy} isRTL={isRTL} colors={colors} />
                      ) : null}
                      {payMethod === "bank_transfer" && paymentConfig.accountNumber ? (
                        <CopyRow label={isRTL ? "رقم الحساب" : "Account No."} value={paymentConfig.accountNumber} onCopy={copy} isRTL={isRTL} colors={colors} />
                      ) : null}
                      {payMethod === "instapay" && paymentConfig.instapayId ? (
                        <CopyRow label="InstaPay" value={paymentConfig.instapayId} onCopy={copy} isRTL={isRTL} colors={colors} />
                      ) : null}
                      {payMethod === "e_wallet" && paymentConfig.ewalletNumber ? (
                        <CopyRow label={isRTL ? "المحفظة" : "Wallet"} value={paymentConfig.ewalletNumber} onCopy={copy} isRTL={isRTL} colors={colors} />
                      ) : null}
                      {paymentConfig.notes ? (
                        <Text style={[styles.configNote, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                          {paymentConfig.notes}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* Sender account input */}
                  <View>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                      {senderLabel()} *
                    </Text>
                    <TextInput
                      style={[styles.textInput, {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        textAlign: isRTL ? "right" : "left",
                      }]}
                      placeholder={isRTL ? "أدخل رقم حسابك / معرّفك" : "Enter your account / ID"}
                      placeholderTextColor={colors.mutedForeground}
                      value={senderAccount}
                      onChangeText={setSenderAccount}
                      keyboardType="default"
                      autoCapitalize="none"
                    />
                  </View>

                  {payMethod === "bank_transfer" && (
                    <View>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                        {isRTL ? "اسم صاحب الحساب (اختياري)" : "Account holder name (optional)"}
                      </Text>
                      <TextInput
                        style={[styles.textInput, {
                          color: colors.foreground,
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          textAlign: isRTL ? "right" : "left",
                        }]}
                        placeholder={isRTL ? "اسمك كما في البنك" : "Your name as on bank"}
                        placeholderTextColor={colors.mutedForeground}
                        value={senderName}
                        onChangeText={setSenderName}
                      />
                    </View>
                  )}

                  <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 10, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[styles.backBtn, { borderColor: colors.border }]}
                      onPress={() => setModalStep("method")}
                    >
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {isRTL ? "← السابق" : "← Back"}
                      </Text>
                    </TouchableOpacity>
                    <FanniButton
                      title={isRTL ? "مراجعة →" : "Review →"}
                      onPress={() => {
                        if (!senderAccount.trim()) {
                          Alert.alert(isRTL ? "مطلوب" : "Required", isRTL ? "أدخل بيانات حسابك" : "Enter your account details");
                          return;
                        }
                        setModalStep("review");
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              )}

              {/* ── STEP 3: Review & Confirm ── */}
              {modalStep === "review" && selectedPkg && (
                <View style={{ gap: 12, marginTop: 8 }}>
                  <View style={[styles.reviewCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <ReviewRow label={isRTL ? "الباقة" : "Package"} value={isRTL ? selectedPkg.nameAr : selectedPkg.nameEn} isRTL={isRTL} colors={colors} />
                    <ReviewRow label={isRTL ? "المبلغ" : "Amount"} value={`${parseFloat(selectedPkg.priceEgp).toFixed(0)} ${isRTL ? "ج.م" : "EGP"}`} isRTL={isRTL} colors={colors} />
                    <ReviewRow label={isRTL ? "النقاط" : "Points"} value={`${selectedPkg.pointsAmount} ${isRTL ? "نقطة" : "pts"}`} isRTL={isRTL} colors={colors} />
                    <ReviewRow label={isRTL ? "وسيلة الدفع" : "Method"} value={methodLabel(payMethod)} isRTL={isRTL} colors={colors} />
                    <ReviewRow
                      label={isRTL ? "حسابك" : "Your account"}
                      value={senderAccount}
                      isRTL={isRTL}
                      colors={colors}
                      highlight
                    />
                    {companyAccountValue() && (
                      <ReviewRow
                        label={isRTL ? "إلى حساب" : "To account"}
                        value={companyAccountValue()!}
                        isRTL={isRTL}
                        colors={colors}
                      />
                    )}
                  </View>

                  <View style={[styles.warningBox, { borderColor: "#F59E0B44", backgroundColor: "#FEF3C7" }]}>
                    <Text style={{ color: "#92400E", fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                      {isRTL
                        ? "⚠️ بعد إرسال الطلب ستبقى النقاط «قيد الانتظار» حتى يتأكد المسؤول من استلام التحويل. ستصلك إشعار فور التأكيد."
                        : "⚠️ After submitting, points stay 'pending' until admin confirms receipt. You'll receive an in-app notification once confirmed."}
                    </Text>
                  </View>

                  <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.backBtn, { borderColor: colors.border }]}
                      onPress={() => setModalStep("sender")}
                    >
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                        {isRTL ? "← السابق" : "← Back"}
                      </Text>
                    </TouchableOpacity>
                    <FanniButton
                      title={submitLoading ? (isRTL ? "جارٍ الإرسال…" : "Sending…") : (isRTL ? "إرسال الطلب ✓" : "Submit ✓")}
                      onPress={submitPaymentRequest}
                      loading={submitLoading}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          NOTIFICATIONS MODAL
       ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={notifVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotifVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {isRTL ? "🔔 الإشعارات" : "🔔 Notifications"}
              </Text>
              <TouchableOpacity onPress={() => setNotifVisible(false)}>
                <VectorIcon name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.map((n) => (
                <View key={n.id} style={[styles.notifItem, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                      {isRTL ? n.titleAr : n.titleEn}
                    </Text>
                    {(isRTL ? n.bodyAr : n.bodyEn) ? (
                      <Text style={[styles.notifBody, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                        {isRTL ? n.bodyAr : n.bodyEn}
                      </Text>
                    ) : null}
                    <Text style={[styles.notifDate, { color: colors.mutedForeground }]}>
                      {new Date(n.createdAt).toLocaleString(isRTL ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => void dismissNotification(n.id)} style={styles.notifDismiss}>
                    <VectorIcon name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            {notifications.length > 1 && (
              <TouchableOpacity
                style={[styles.readAllBtn, { borderColor: colors.border }]}
                onPress={() => void dismissAllNotifications()}
              >
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {isRTL ? "تحديد الكل كمقروء" : "Mark all as read"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function CopyRow({
  label, value, onCopy, isRTL, colors,
}: { label: string; value: string; onCopy: (v: string) => void; isRTL: boolean; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <TouchableOpacity
      style={[styles.copyRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
      onPress={() => onCopy(value)}
      activeOpacity={0.7}
    >
      <Text style={[styles.copyLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 4 }}>
        <Text style={[styles.copyValue, { color: colors.foreground }]}>{value}</Text>
        <VectorIcon name="copy" size={12} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

function ReviewRow({
  label, value, isRTL, colors, highlight,
}: { label: string; value: string; isRTL: boolean; colors: ReturnType<typeof import("@/hooks/useColors").useColors>; highlight?: boolean }) {
  return (
    <View style={[styles.reviewRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: highlight ? colors.primary : colors.foreground }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },

  notifBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, marginBottom: 2,
  },
  notifBannerText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },

  // Balance
  balanceCard: {
    borderRadius: 16, padding: 20, alignItems: "center", gap: 6, marginBottom: 16,
  },
  balanceLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: "rgba(255,255,255,0.8)" },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  balanceAmount: { fontFamily: "Inter_700Bold", fontSize: 40, color: "#fff" },
  balancePtsLabel: { fontFamily: "Inter_500Medium", fontSize: 16, color: "rgba(255,255,255,0.8)" },

  // How-to
  howToCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16, gap: 10 },
  howToTitle: { fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 4 },
  stepRow: { alignItems: "flex-start", gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 11 },
  stepText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },

  // Section
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 10 },

  // Package
  pkgCard: {
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  pkgLeft: { alignItems: "center", gap: 12, flex: 1 },
  pkgPtsBadge: { borderRadius: 12, padding: 10, alignItems: "center", minWidth: 60 },
  pkgPtsNum: { fontFamily: "Inter_700Bold", fontSize: 20 },
  pkgPtsLabel: { fontFamily: "Inter_500Medium", fontSize: 11 },
  pkgInfo: { flex: 1, gap: 2 },
  pkgName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  pkgOrigPrice: { fontFamily: "Inter_400Regular", fontSize: 12, textDecorationLine: "line-through" },
  pkgRight: { alignItems: "flex-end", gap: 4 },
  discountBadge: { backgroundColor: "#22C55E", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 10 },
  pkgPrice: { fontFamily: "Inter_700Bold", fontSize: 16 },

  // Request rows
  reqRow: { borderRadius: 10, borderWidth: 1, marginBottom: 8, overflow: "hidden" },
  reqStripe: { width: 4 },
  reqHeader: { alignItems: "center", gap: 6, marginBottom: 2, padding: 10, paddingBottom: 0 },
  reqAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
  reqPts: { fontFamily: "Inter_500Medium", fontSize: 12 },
  reqStatus: { fontFamily: "Inter_600SemiBold", fontSize: 12, paddingHorizontal: 10 },
  reqMethod: { fontFamily: "Inter_400Regular", fontSize: 12, paddingHorizontal: 10 },
  reqNote: { fontFamily: "Inter_400Regular", fontSize: 11, paddingHorizontal: 10, marginTop: 2, fontStyle: "italic" },
  reqDate: { fontFamily: "Inter_400Regular", fontSize: 11, paddingHorizontal: 10, paddingBottom: 10, marginTop: 2, opacity: 0.7 },

  // Transactions
  txRow: { borderRadius: 10, borderWidth: 1, marginBottom: 8, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txInfo: { flex: 1, gap: 2 },
  txLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  txDesc: { fontFamily: "Inter_400Regular", fontSize: 11 },
  txDate: { fontFamily: "Inter_400Regular", fontSize: 11 },
  txAmount: { fontFamily: "Inter_700Bold", fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalBox: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, padding: 20, paddingBottom: 40, gap: 12,
    maxHeight: "92%",
  },
  modalHeader: { justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  pkgSummary: { padding: 12, gap: 4 },
  pkgSummaryName: { fontFamily: "Inter_700Bold", fontSize: 15 },
  pkgSummaryDetail: { fontFamily: "Inter_500Medium", fontSize: 13 },

  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 },
  textInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: "Inter_400Regular", fontSize: 14,
  },
  backBtn: {
    borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16,
    alignItems: "center", justifyContent: "center",
  },

  // Method cards
  methodCard: {
    borderWidth: 1.5, borderRadius: 12, padding: 14, gap: 10, alignItems: "center",
  },
  methodCardText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14 },

  // Account card (copy rows)
  accountCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden", padding: 4 },
  accountCardTitle: { fontFamily: "Inter_500Medium", fontSize: 12, padding: 10, paddingBottom: 6 },
  copyRow: {
    paddingHorizontal: 12, paddingVertical: 9,
    justifyContent: "space-between", alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#00000011",
  },
  copyLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  copyValue: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  configNote: { fontFamily: "Inter_400Regular", fontSize: 11, padding: 10, paddingTop: 6 },

  // Review card
  reviewCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  reviewRow: {
    paddingHorizontal: 14, paddingVertical: 10,
    justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#00000011",
  },
  reviewLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
  reviewValue: { fontFamily: "Inter_600SemiBold", fontSize: 13 },

  warningBox: { borderRadius: 10, borderWidth: 1, padding: 12 },

  // Notifications modal
  notifItem: {
    borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8,
    flexDirection: "row", alignItems: "flex-start", gap: 8,
  },
  notifTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 4 },
  notifBody: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  notifDate: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 6, opacity: 0.7 },
  notifDismiss: { padding: 4 },
  readAllBtn: {
    borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 8,
  },
});
