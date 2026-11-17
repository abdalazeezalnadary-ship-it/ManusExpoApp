import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createCorsMiddleware } from "./cors";

const app = express();
const server = createServer(app);
app.disable("x-powered-by");
app.use(createCorsMiddleware());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: false }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "dream-city-api", timestamp: Date.now() });
});
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("PORT must be an integer between 1024 and 65535.");
}
server.listen(port, host, () => console.log(`[api] listening on ${host}:${port}`));

function shutdown(signal: string) {
  console.log(`[api] received ${signal}; shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
