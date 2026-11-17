import type { RequestHandler } from "express";

function configuredOrigins(): Set<string> {
  return new Set(
    (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => {
        if (!origin) return false;
        try {
          const parsed = new URL(origin);
          return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.origin === origin;
        } catch {
          return false;
        }
      }),
  );
}

export function createCorsMiddleware(): RequestHandler {
  const allowed = configuredOrigins();
  return (req, res, next) => {
    const origin = req.headers.origin;
    res.vary("Origin");
    // Native requests normally have no Origin and authenticate with a bearer token.
    if (!origin) return next();

    let permitted = allowed.has(origin);
    if (!permitted && process.env.NODE_ENV !== "production") {
      try {
        const parsed = new URL(origin);
        const localApiHost = ["localhost", "127.0.0.1", "::1"].includes(req.hostname);
        permitted = localApiHost && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) && [8081, 19006, 19000].includes(Number(parsed.port));
      } catch {
        permitted = false;
      }
    }
    if (!permitted) return res.status(403).json({ error: "origin_not_allowed" });

    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, X-Requested-With");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  };
}
