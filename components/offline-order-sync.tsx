import { useEffect, useMemo } from "react";
import { createTRPCClient } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";
import { flushOrderQueue, pendingOrderCount } from "@/lib/offline-queue";
import { useConnectivity } from "@/lib/use-connectivity";

export function OfflineOrderSync() {
  const online = useConnectivity();
  const client = useMemo(() => createTRPCClient(), []);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    let running = false;
    const synchronize = async () => {
      if (cancelled || running || !(await Auth.getSessionToken()) || (await pendingOrderCount()) === 0) return;
      running = true;
      try {
        await flushOrderQueue((order) => client.orders.create.mutate({
          ...order,
          orderType: order.orderType === "table" ? "dine_in" : order.orderType,
          splitMetadata: order.split,
        } as never));
      } catch {
        // The queue retains unsent entries; retry on the next connectivity tick.
      } finally {
        running = false;
      }
    };
    void synchronize();
    const timer = setInterval(() => void synchronize(), 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [online, client]);

  return null;
}
