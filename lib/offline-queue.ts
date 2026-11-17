import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { CartLine } from "@/lib/restaurant-context";

const QUEUE_KEY = "dreamcity.offline-queue.v1";
let queueFlushInProgress = false;

export type PendingOrder = {
  clientOrderId: string;
  branchCode: string;
  orderType: "delivery" | "pickup" | "table";
  items: Array<{ menuItemCode: string; quantity: number }>;
  tableNumber?: string;
  deliveryDetails?: { customerName: string; phone: string; address: string };
  deliveryZoneCode?: string;
  couponCode?: string;
  loyaltyPoints?: number;
  split?: { mode: "equal" | "items"; people: number; assignments?: Record<string, number> };
  createdAt: string;
};

async function readQueue(): Promise<PendingOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function queueOrder(input: Omit<PendingOrder, "createdAt">): Promise<PendingOrder> {
  const order = { ...input, createdAt: new Date().toISOString() };
  const current = await readQueue();
  if (!current.some((entry) => entry.clientOrderId === order.clientOrderId)) {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...current, order]));
  }
  return order;
}

export async function pendingOrderCount(): Promise<number> {
  return (await readQueue()).length;
}

export async function listPendingOrders(): Promise<PendingOrder[]> {
  return readQueue();
}

export async function flushOrderQueue(send: (order: PendingOrder) => Promise<unknown>): Promise<number> {
  if (queueFlushInProgress) return 0;
  queueFlushInProgress = true;
  let delivered = 0;
  try {
    const queue = await readQueue();
    const remaining: PendingOrder[] = [];
    for (const order of queue) {
      try {
        await send(order);
        delivered += 1;
      } catch {
        remaining.push(order);
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } finally {
    queueFlushInProgress = false;
  }
  return delivered;
}

export function makePendingOrder(
  branchCode: string,
  orderType: PendingOrder["orderType"],
  cart: CartLine[],
  extras?: Pick<PendingOrder, "tableNumber" | "deliveryDetails" | "deliveryZoneCode">,
): Omit<PendingOrder, "createdAt"> {
  const randomPart = Crypto.randomUUID();
  return {
    clientOrderId: `dc-${randomPart}`,
    branchCode,
    orderType,
    items: cart.map(({ id, quantity }) => ({ menuItemCode: id, quantity })),
    ...extras,
  };
}
