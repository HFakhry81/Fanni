import React, { createContext, useContext, useState, useEffect } from "react";
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
  latitude?: number;
  longitude?: number;
  visitDate: string;
  visitTime: string;
  status: "pending" | "accepted" | "inProgress" | "completed" | "cancelled";
  technicianId?: string;
  technicianName?: string;
  technicianMobile?: string;
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
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const SEED_ORDERS: Order[] = [
  {
    id: "ord001",
    orderNumber: "ORD-2024-001",
    clientId: "client1",
    clientName: "أحمد محمد",
    clientMobile: "01012345678",
    category: "ac",
    subCategory: "AC Repair",
    problemDescription: "المكيف لا يبرد بشكل جيد وتظهر منه روائح كريهة",
    deviceType: "مكيف سبليت 1.5 حصان",
    photos: [],
    street: "شارع التحرير",
    building: "15",
    floor: "3",
    apartment: "12",
    landmark: "بجوار مسجد النور",
    visitDate: "2024-01-20",
    visitTime: "10:00",
    status: "completed",
    technicianId: "tech1",
    technicianName: "محمد علي",
    technicianMobile: "01098765432",
    technicianRating: 4.8,
    materials: [{ id: "m1", description: "فريون", amount: 250 }],
    solutionDescription: "تم تعبئة الفريون وتنظيف الفلاتر",
    clientSatisfaction: "satisfied",
    completionStatus: "solved",
    invoice: {
      invoiceNumber: "INV-2024-001",
      date: "2024-01-20",
      materialsTotal: 250,
      materialsMark: 25,
      laborFee: 200,
      toolRental: 50,
      tax: 75.25,
      vat: 90.75,
      total: 691,
      companyName: "فني للصيانة المنزلية",
      companyPhone: "01000000000",
      orderId: "ord001",
      clientName: "أحمد محمد",
      technicianName: "محمد علي",
    },
    clientRating: 5,
    clientComment: "خدمة ممتازة وفني محترف",
    createdAt: "2024-01-19T09:00:00Z",
  },
  {
    id: "ord002",
    orderNumber: "ORD-2024-002",
    clientId: "client1",
    clientName: "أحمد محمد",
    clientMobile: "01012345678",
    category: "electricity",
    subCategory: "Electrical Wiring",
    problemDescription: "انقطاع متكرر في الكهرباء بالغرفة الرئيسية",
    deviceType: "توصيلات كهربائية",
    photos: [],
    street: "شارع النيل",
    building: "22",
    floor: "1",
    apartment: "5",
    landmark: "أمام البنك الأهلي",
    visitDate: "2024-01-25",
    visitTime: "14:00",
    status: "accepted",
    technicianId: "tech1",
    technicianName: "محمد علي",
    technicianMobile: "01098765432",
    technicianRating: 4.8,
    createdAt: "2024-01-24T10:00:00Z",
  },
];

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(SEED_ORDERS);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("orders");
        if (stored) {
          const parsed = JSON.parse(stored) as Order[];
          setOrders([...SEED_ORDERS, ...parsed]);
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
  };

  const updateOrder = async (id: string, update: Partial<Order>) => {
    const updated = orders.map((o) => (o.id === id ? { ...o, ...update } : o));
    setOrders(updated);
    await saveOrders(updated);
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
