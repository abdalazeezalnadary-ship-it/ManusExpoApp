type OrderPolicyInput = {
  from: string;
  to: string;
  orderType: string;
  paymentMethod: string | null;
  paymentStatus: string;
  assignedDriverId: number | null;
  actorId: number;
};

/** Authorization is performed by protectedProcedure; this function only validates state and ownership invariants. */
export function orderStatusTransitionAllowed(input: OrderPolicyInput): boolean {
  const { from, to, orderType, paymentMethod, paymentStatus, assignedDriverId, actorId } = input;
  if (to === "out_for_delivery") return orderType === "delivery" && from === "ready" && assignedDriverId === actorId;
  if (to === "completed") return orderType !== "delivery" && from === "ready" && (paymentMethod === "cash" || paymentStatus === "paid");
  if (to === "cancelled") return ["pending", "confirmed", "preparing"].includes(from) && paymentStatus !== "paid";
  const transitions: Record<string, readonly string[]> = {
    pending: ["confirmed"],
    confirmed: ["preparing"],
    preparing: ["ready"],
  };
  return transitions[from]?.includes(to) ?? false;
}

export function canServeReadyOrder(orderStatus: string, orderType: string): boolean {
  return orderStatus === "ready" && orderType !== "delivery";
}

export function kdsItemTransitionAllowed(input: {
  from: string;
  to: string;
}): boolean {
  const { from, to } = input;
  if (to === "cooking") return ["pending", "queued"].includes(from);
  if (to === "ready") return ["cooking", "preparing"].includes(from);
  if (to === "served") return from === "ready";
  return false;
}
