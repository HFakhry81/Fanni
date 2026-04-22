import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface OrderPhoto {
  uri: string;
  id: string;
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
  mergeOrders: (incoming: Order[]) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const SEED_ORDERS: Order[] = [
  {
    id: "ord001",
    orderNumber: "ORD-2025-001",
    clientId: "client1",
    clientName: "أحمد محمد السيد",
    clientMobile: "01012345678",
    category: "ac",
    subCategory: "صيانة مكيفات",
    problemDescription: "المكيف لا يبرد بشكل جيد وتظهر منه روائح كريهة عند التشغيل",
    deviceType: "مكيف سبليت 1.5 حصان",
    photos: [],
    street: "شارع النصر",
    building: "15",
    floor: "3",
    apartment: "12",
    landmark: "بجوار مسجد الرحمن",
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
    problemDescription: "انقطاع متكرر في الكهرباء بالغرفة الرئيسية وشرارة عند اللمسات",
    deviceType: "توصيلات كهربائية",
    photos: [],
    street: "شارع سموحة",
    building: "22",
    floor: "1",
    apartment: "5",
    landmark: "أمام بنك مصر",
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
  {
    id: "ord003",
    orderNumber: "ORD-2025-003",
    clientId: "client1",
    clientName: "أحمد محمد السيد",
    clientMobile: "01012345678",
    category: "plumbing",
    subCategory: "مواسير",
    problemDescription: "تسريب مياه في ماسورة الحمام الرئيسي",
    deviceType: "مواسير",
    photos: [],
    street: "شارع فلمنج",
    building: "7",
    floor: "2",
    apartment: "8",
    landmark: "بجوار سوبر ماركت كارفور",
    latitude: 31.2271,
    longitude: 29.9658,
    visitDate: "2025-04-22",
    visitTime: "11:00",
    status: "pending",
    createdAt: "2025-04-21T14:00:00Z",
  },
];

export const SIMULATED_NEW_ORDER: Order = {
  id: "ord_sim001",
  orderNumber: "ORD-2025-004",
  clientId: "client2",
  clientName: "سارة إبراهيم",
  clientMobile: "01155667788",
  category: "carpentry",
  subCategory: "نجارة",
  problemDescription: "باب الغرفة الرئيسية لا يغلق بشكل صحيح ويحتاج إلى ضبط المفصلات",
  deviceType: "باب خشبي",
  photos: [],
  street: "شارع سيدي بشر",
  building: "3",
  floor: "4",
  apartment: "14",
  landmark: "بجوار مدرسة الأمل",
  latitude: 31.2310,
  longitude: 29.9700,
  visitDate: "2025-04-22",
  visitTime: "15:00",
  status: "pending",
  createdAt: new Date().toISOString(),
};

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(SEED_ORDERS);
  const seenIdsRef = useRef<Set<string>>(new Set(SEED_ORDERS.map((o) => o.id)));
  const [newPendingOrders, setNewPendingOrders] = useState<Order[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("orders");
        if (stored) {
          const parsed = JSON.parse(stored) as Order[];
          const merged = [...SEED_ORDERS, ...parsed];
          setOrders(merged);
          parsed.forEach((o) => seenIdsRef.current.add(o.id));
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
    const updated = orders.map((o) => (o.id === id ? { ...o, ...update } : o));
    setOrders(updated);
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
    setOrders((prev) => {
      if (prev.find((o) => o.id === order.id)) return prev;
      return [...prev, order];
    });
    setNewPendingOrders((prev) => {
      if (prev.find((o) => o.id === order.id)) return prev;
      return [...prev, order];
    });
  };

  const mergeOrders = (incoming: Order[]) => {
    setOrders((prev) => {
      const existingIds = new Set(prev.map((o) => o.id));
      const toAdd = incoming.filter((o) => !existingIds.has(o.id));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
  };

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
        mergeOrders,
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
