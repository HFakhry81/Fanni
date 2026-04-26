import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SEED_VERSION } from "../constants/seedVersion";

export interface OrderPhoto {
  uri: string;
  id: string;
  phase?: "problem" | "before" | "during" | "after";
  timestamp?: string;
}

export interface MaterialItem {
  id: string;
  invoicePhoto?: string;
  description: string;
  amount: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  category: string;
  subCategory: string;
  subImageKey?: string;
  problemDescription: string;
  deviceType: string;
  photos: OrderPhoto[];
  street: string;
  building: string;
  floor: string;
  apartment: string;
  landmark: string;
  governorate?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  visitDate: string;
  visitTime: string;
  status: "pending" | "accepted" | "inProgress" | "completed" | "cancelled";
  technicianId?: string;
  technicianName?: string;
  technicianMobile?: string;
  technicianAvatar?: string;
  technicianRating?: number;
  materials?: MaterialItem[];
  solutionDescription?: string;
  clientSatisfaction?: "satisfied" | "neutral" | "unsatisfied";
  completionStatus?: "solved" | "stillExists" | "worsened";
  invoice?: Invoice;
  threePartyInvoice?: ThreePartyInvoice;
  clientRating?: number;
  clientComment?: string;
  createdAt: string;
}

export interface Invoice {
  invoiceNumber: string;
  date: string;
  materialsTotal: number;
  materialsMark: number;
  laborFee: number;
  toolRental: number;
  tax: number;
  vat: number;
  total: number;
  companyName: string;
  companyPhone: string;
  orderId: string;
  clientName: string;
  technicianName: string;
}

export interface OcrLineItem {
  description: string;
  qty: number;
  unit?: string | null;
  unitPrice: number;
  totalPrice: number;
}

export interface OcrReceiptData {
  supplier?: string | null;
  date?: string | null;
  lineItems: OcrLineItem[];
  detectedTotal: number;
  photoUrl: string;
}

export interface ThreePartyInvoice {
  labourFee: number;
  transportFee: number;
  materialsTotal: number;
  serviceFeeRate: number;
  serviceFeeAmount: number;
  vatRate: number;
  vatAmount: number;
  techNetTotal: number;
  clientTotal: number;
  adminTotal: number;
  receiptPhotos: string[];
  ocrLineItems: OcrReceiptData[];
  generatedAt: string;
}

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => Promise<void>;
  updateOrder: (id: string, update: Partial<Order>) => Promise<void>;
  getOrdersByClient: (clientId: string) => Order[];
  getOrdersByTech: (techId: string) => Order[];
  getActiveOrdersForTech: (techId: string) => Order[];
  allOrders: Order[];
  newPendingOrders: Order[];
  markPendingOrdersSeen: () => void;
  markOrderSeen: (orderId: string) => void;
  injectNewOrder: (order: Order) => void;
  removePendingOrder: (orderId: string) => void;
  mergeOrders: (incoming: Order[]) => void;
  syncOrders: (incoming: Order[]) => void;
  wsOrderStatusSignal: number;
  bumpWsOrderStatusSignal: () => void;
  availablePendingCount: number;
  setAvailablePendingCount: (count: number) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const SEED_VERSION_KEY = "orders_seed_version";

const SEED_ORDERS: Order[] = [
  {
    id: "ord001",
    orderNumber: "ORD-2025-001",
    clientId: "client1",
    clientName: "أحمد محمد السيد",
    clientMobile: "01012345678",
    category: "ac",
    subCategory: "صيانة مكيفات",
    subImageKey: "sub_ac_repair",
    problemDescription: "المكيف لا يبرد بشكل جيد وتظهر منه روائح كريهة عند التشغيل",
    deviceType: "مكيف سبليت 1.5 حصان",
    photos: [],
    street: "شارع النصر",
    building: "15",
    floor: "3",
    apartment: "12",
    landmark: "بجوار مسجد الرحمن",
    governorate: "alexandria",
    area: "سموحة",
    latitude: 31.2156,
    longitude: 29.9553,
    visitDate: "2025-04-10",
    visitTime: "10:00",
    status: "completed",
    technicianId: "tech1",
    technicianName: "محمد علي حسن",
    technicianMobile: "01098765432",
    technicianRating: 4.8,
    materials: [
      { id: "m1", description: "فريون R410A", amount: 280 },
      { id: "m2", description: "مستلزمات تنظيف", amount: 50 },
    ],
    solutionDescription: "تم تعبئة الفريون وتنظيف الفلاتر والإيفاباريتر",
    clientSatisfaction: "satisfied",
    completionStatus: "solved",
    invoice: {
      invoiceNumber: "INV-2025-001",
      date: "2025-04-10",
      materialsTotal: 330,
      materialsMark: 33,
      laborFee: 250,
      toolRental: 50,
      tax: 93.1,
      vat: 111.45,
      total: 867.55,
      companyName: "فني للصيانة المنزلية",
      companyPhone: "01000000000",
      orderId: "ord001",
      clientName: "أحمد محمد السيد",
      technicianName: "محمد علي حسن",
    },
    clientRating: 5,
    clientComment: "خدمة ممتازة وفني محترف جداً",
    createdAt: "2025-04-09T09:00:00Z",
  },
  {
    id: "ord002",
    orderNumber: "ORD-2025-002",
    clientId: "client1",
    clientName: "أحمد محمد السيد",
    clientMobile: "01012345678",
    category: "electricity",
    subCategory: "توصيلات كهربائية",
    subImageKey: "sub_electrical_wiring",
    problemDescription: "انقطاع متكرر في الكهرباء بالغرفة الرئيسية وشرارة عند اللمسات",
    deviceType: "توصيلات كهربائية",
    photos: [],
    street: "شارع سموحة",
    building: "22",
    floor: "1",
    apartment: "5",
    landmark: "أمام بنك مصر",
    governorate: "alexandria",
    area: "سموحة",
    latitude: 31.2101,
    longitude: 29.9502,
    visitDate: "2025-04-20",
    visitTime: "14:00",
    status: "accepted",
    technicianId: "tech1",
    technicianName: "محمد علي حسن",
    technicianMobile: "01098765432",
    technicianRating: 4.8,
    createdAt: "2025-04-18T10:00:00Z",
  },
  // NOTE: This order uses category "ac" to match the demo technician's registered service
  // categories. The demo tech's available service categories are configured in
  // SERVICE_CATEGORIES (artifacts/mobile/app/register.tsx and app/(tech)/profile.tsx)
  // and stored in user.serviceCategories. For demo flows the expected technician skill set
  // is ["ac", "electricity"]. If the demo tech's registered categories change, update the
  // category here so this pending order remains visible to them via the broadcaster filter.
  {
    id: "ord003",
    orderNumber: "ORD-2025-003",
    clientId: "client2",
    clientName: "هالة يوسف منصور",
    clientMobile: "01211223344",
    category: "ac",
    subCategory: "صيانة مكيفات",
    subImageKey: "sub_ac_repair",
    problemDescription: "المكيف يعمل لكنه لا يبرد بشكل كافٍ والجسم الخارجي يصدر صوتاً غير طبيعي",
    deviceType: "مكيف سبليت 2 حصان",
    photos: [],
    street: "شارع فلمنج",
    building: "7",
    floor: "2",
    apartment: "8",
    landmark: "بجوار سوبر ماركت كارفور",
    governorate: "alexandria",
    area: "فلمنج",
    latitude: 31.2271,
    longitude: 29.9658,
    visitDate: "2025-04-22",
    visitTime: "11:00",
    status: "pending",
    createdAt: "2025-04-21T14:00:00Z",
  },
];

export const SEED_USER_IDS: ReadonlySet<string> = new Set(
  SEED_ORDERS.flatMap((o) => [o.clientId, ...(o.technicianId ? [o.technicianId] : [])])
);

const SIMULATED_ORDER_CATEGORY_CONTENT: Record<
  string,
  { subCategory: string; subImageKey: string; problemDescription: string; deviceType: string }
> = {
  electricity: {
    subCategory: "توصيلات كهربائية",
    subImageKey: "sub_electrical_wiring",
    problemDescription: "انقطاع مفاجئ في التيار الكهربائي ببعض الأوتاكات في غرفة المعيشة",
    deviceType: "توصيلات كهربائية",
  },
  ac: {
    subCategory: "صيانة مكيفات",
    subImageKey: "sub_ac_repair",
    problemDescription: "المكيف يعمل لكنه لا يبرد بشكل كافٍ ويصدر أصواتاً غريبة من الجسم الخارجي",
    deviceType: "مكيف سبليت 1.5 حصان",
  },
  plumbing: {
    subCategory: "تسريب مياه",
    subImageKey: "sub_plumbing_leak",
    problemDescription: "تسريب مياه أسفل المغسلة في الحمام الرئيسي مع تراكم الماء على الأرضية",
    deviceType: "صنابير ومواسير",
  },
  appliances: {
    subCategory: "صيانة غسالة",
    subImageKey: "sub_appliances_washing",
    problemDescription: "الغسالة لا تعمل وتصدر صوتاً عالياً أثناء الدوران ولا تستكمل الدورة",
    deviceType: "غسالة أوتوماتيك 7 كيلو",
  },
  carpentry: {
    subCategory: "إصلاح باب",
    subImageKey: "sub_carpentry_door",
    problemDescription: "الباب لا يغلق بشكل صحيح ومفصلته مكسورة وتحتاج استبدالاً",
    deviceType: "باب خشبي داخلي",
  },
  painting: {
    subCategory: "دهان جدران",
    subImageKey: "sub_painting_walls",
    problemDescription: "جدران المطبخ تحتاج إعادة دهان بعد تأثر البوية بالرطوبة",
    deviceType: "جدران داخلية",
  },
  pest: {
    subCategory: "مكافحة حشرات",
    subImageKey: "sub_pest_cockroach",
    problemDescription: "انتشار صراصير في المطبخ والحمامات ويحتاج الأمر رش شامل",
    deviceType: "حشرات زاحفة",
  },
  flooring: {
    subCategory: "تركيب بلاط",
    subImageKey: "sub_flooring_tiles",
    problemDescription: "بلاطة مكسورة في الممر الرئيسي تحتاج استبدالاً سريعاً",
    deviceType: "بلاط سيراميك",
  },
};

const SIMULATED_ORDER_FALLBACK_CATEGORY = "ac";

export function buildSimulatedOrder(serviceCategories?: string[]): Order {
  const categories = (serviceCategories ?? []).filter(
    (c) => c in SIMULATED_ORDER_CATEGORY_CONTENT
  );
  const resolvedCategory =
    categories.length > 0
      ? categories[Math.floor(Math.random() * categories.length)]
      : SIMULATED_ORDER_FALLBACK_CATEGORY;

  const content = SIMULATED_ORDER_CATEGORY_CONTENT[resolvedCategory]!;
  const category = resolvedCategory;

  const uniqueId = `ord_sim_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  return {
    id: uniqueId,
    orderNumber: "ORD-DEMO",
    clientId: "client3",
    clientName: "سارة إبراهيم",
    clientMobile: "01155667788",
    category,
    subCategory: content.subCategory,
    subImageKey: content.subImageKey,
    problemDescription: content.problemDescription,
    deviceType: content.deviceType,
    photos: [],
    street: "شارع سيدي بشر",
    building: "3",
    floor: "4",
    apartment: "14",
    landmark: "بجوار مدرسة الأمل",
    governorate: "alexandria",
    area: "سيدي بشر",
    latitude: 31.231,
    longitude: 29.97,
    visitDate: "2025-04-22",
    visitTime: "15:00",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(SEED_ORDERS);
  const seenIdsRef = useRef<Set<string>>(new Set(SEED_ORDERS.map((o) => o.id)));
  const injectedOrderIdsRef = useRef<Set<string>>(new Set(SEED_ORDERS.map((o) => o.id)));
  const [newPendingOrders, setNewPendingOrders] = useState<Order[]>([]);
  const [wsOrderStatusSignal, setWsOrderStatusSignal] = useState(0);
  const [availablePendingCount, setAvailablePendingCount] = useState(0);

  const bumpWsOrderStatusSignal = React.useCallback(() => {
    setWsOrderStatusSignal((prev) => prev + 1);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const seedIds = new Set(SEED_ORDERS.map((o) => o.id));
        const storedVersion = await AsyncStorage.getItem(SEED_VERSION_KEY);

        if (storedVersion !== SEED_VERSION) {
          const stored = await AsyncStorage.getItem("orders");
          const userOrders: Order[] = stored
            ? (JSON.parse(stored) as Order[]).filter((o) => !seedIds.has(o.id))
            : [];
          await AsyncStorage.setItem("orders", JSON.stringify(userOrders));
          await AsyncStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
          const merged = [...SEED_ORDERS, ...userOrders];
          setOrders(merged);
          userOrders.forEach((o) => seenIdsRef.current.add(o.id));
        } else {
          const stored = await AsyncStorage.getItem("orders");
          if (stored) {
            const parsed = JSON.parse(stored) as Order[];
            const merged = [...SEED_ORDERS, ...parsed];
            setOrders(merged);
            parsed.forEach((o) => seenIdsRef.current.add(o.id));
          }
        }
      } catch (_) {}
    })();
  }, []);

  const saveOrders = async (newOrders: Order[]) => {
    const userOrders = newOrders.filter(
      (o) => !SEED_ORDERS.find((s) => s.id === o.id)
    );
    try {
      await AsyncStorage.setItem("orders", JSON.stringify(userOrders));
    } catch (_) {}
  };

  const addOrder = async (order: Order) => {
    const updated = [...orders, order];
    setOrders(updated);
    await saveOrders(updated);
    if (!seenIdsRef.current.has(order.id) && order.status === "pending") {
      seenIdsRef.current.add(order.id);
      setNewPendingOrders((prev) => [...prev, order]);
    }
  };

  const updateOrder = async (id: string, update: Partial<Order>) => {
    let updated: Order[] = [];
    setOrders((prev) => {
      updated = prev.map((o) => (o.id === id ? { ...o, ...update } : o));
      return updated;
    });
    await saveOrders(updated);
    if (update.status && update.status !== "pending") {
      setNewPendingOrders((prev) => prev.filter((o) => o.id !== id));
    }
  };

  const markPendingOrdersSeen = () => {
    newPendingOrders.forEach((o) => seenIdsRef.current.add(o.id));
    setNewPendingOrders([]);
  };

  const markOrderSeen = (orderId: string) => {
    seenIdsRef.current.add(orderId);
    setNewPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const injectNewOrder = (order: Order) => {
    const isNew = !injectedOrderIdsRef.current.has(order.id);
    if (isNew) {
      injectedOrderIdsRef.current.add(order.id);
    }
    setOrders((prev) => {
      if (prev.find((o) => o.id === order.id)) return prev;
      return [...prev, order];
    });
    setNewPendingOrders((prev) => {
      if (prev.find((o) => o.id === order.id)) return prev;
      return [...prev, order];
    });
    if (isNew) {
      setAvailablePendingCount((prev) => prev + 1);
    }
  };

  const removePendingOrder = (orderId: string) => {
    const wasInjected = injectedOrderIdsRef.current.has(orderId);
    if (wasInjected) {
      injectedOrderIdsRef.current.delete(orderId);
    }
    setNewPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    if (wasInjected) {
      setAvailablePendingCount((prev) => Math.max(0, prev - 1));
    }
  };

  const mergeOrders = (incoming: Order[]) => {
    setOrders((prev) => {
      const existingIds = new Set(prev.map((o) => o.id));
      const toAdd = incoming.filter((o) => !existingIds.has(o.id));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
  };

  const syncOrders = React.useCallback((incoming: Order[]) => {
    setOrders((prev) => {
      const incomingMap = new Map(incoming.map((o) => [o.id, o]));
      const seedIds = new Set(SEED_ORDERS.map((o) => o.id));
      let changed = false;
      const updated = prev.map((o) => {
        if (seedIds.has(o.id)) return o;
        const fresh = incomingMap.get(o.id);
        if (!fresh) return o;
        const merged = { ...o, ...fresh };
        if (JSON.stringify(merged) !== JSON.stringify(o)) {
          changed = true;
          return merged;
        }
        return o;
      });
      const existingIds = new Set(prev.map((o) => o.id));
      const toAdd = incoming.filter((o) => !existingIds.has(o.id));
      if (!changed && toAdd.length === 0) return prev;
      return toAdd.length > 0 ? [...updated, ...toAdd] : updated;
    });
  }, []);

  const getOrdersByClient = (clientId: string) =>
    orders.filter((o) => o.clientId === clientId);

  const getOrdersByTech = (techId: string) =>
    orders.filter((o) => o.technicianId === techId);

  const getActiveOrdersForTech = (techId: string) =>
    orders.filter(
      (o) =>
        o.technicianId === techId &&
        (o.status === "accepted" || o.status === "inProgress")
    );

  return (
    <OrderContext.Provider
      value={{
        orders,
        addOrder,
        updateOrder,
        getOrdersByClient,
        getOrdersByTech,
        getActiveOrdersForTech,
        allOrders: orders,
        newPendingOrders,
        markPendingOrdersSeen,
        markOrderSeen,
        injectNewOrder,
        removePendingOrder,
        mergeOrders,
        syncOrders,
        wsOrderStatusSignal,
        bumpWsOrderStatusSignal,
        availablePendingCount,
        setAvailablePendingCount,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders must be used within OrderProvider");
  return ctx;
}
