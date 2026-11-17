import { router } from "./_core/trpc";
import { dreamcityRouter } from "./routers/dreamcity";

export const appRouter = router({
  ...dreamcityRouter._def.record,
});

export type AppRouter = typeof appRouter;
