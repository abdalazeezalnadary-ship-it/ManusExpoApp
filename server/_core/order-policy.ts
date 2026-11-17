type OrderPolicyInput = {
  role: string;
  from: string;
  to: string;
  orderType: string;
  paymentMethod: string | null;
  paymentStatus: string;
  assignedDriverId: number | null;
  actorId: number;
};

export function orderStatusTransitionAllowed(input: OrderPolicyInput): boolean {
  const { role, from, to, orderType, paymentMethod, paymentStatus, assignedDriverId, actorId } = input;

  if (to === "out_for_delivery") {
    return role === "driver" && orderType === "delivery" && from === "ready" && assignedDriverId === actorId;
  }

  if (to === "completed") {
    return orderType !== "delivery"
      && from === "ready"
      && (paymentMethod === "cash" || paymentStatus === "paid")
      && ["admin", "manager", "cashier"].includes(role);
  }

  if (to === "cancelled") {
    return ["admin", "manager"].includes(role)
      && ["pending", "confirmed", "preparing"].includes(from)
      && paymentStatus !== "paid";
  }

  const transitions: Record<string, Record<string, readonly string[]>> = {
    pending: { confirmed: ["admin", "manager", "cashier"] },
    confirmed: { preparing: ["admin", "manager", "chef"] },
    preparing: { ready: ["admin", "manager", "chef"] },
  };
  return transitions[from]?.[to]?.includes(role) ?? false;
}

export function canServeReadyOrder(role: string, orderStatus: string, orderType: string): boolean {
  return orderStatus === "ready" && orderType !== "delivery" && ["admin", "manager", "waiter"].includes(role);
}

export function kdsItemTransitionAllowed(input: {
  role: string;
  from: string;
  to: string;
  assignedChefId: number | null;
  actorId: number;
}): boolean {
  const { role, from, to, assignedChefId, actorId } = input;
  const chefOwnsItem = role !== "chef" || assignedChefId == null || assignedChefId === actorId;

  if (to === "cooking") return chefOwnsItem && ["admin", "manager", "chef"].includes(role) && ["pending", "queued"].includes(from);
  if (to === "ready") return chefOwnsItem && ["admin", "manager", "chef"].includes(role) && ["cooking", "preparing"].includes(from);
  if (to === "served") return ["admin", "manager", "waiter"].includes(role) && from === "ready";
  return false;
}
