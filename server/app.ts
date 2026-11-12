import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const configuredOrigins = (process.env["CORS_ORIGINS"] ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 120;
const MAX_RATE_LIMIT_ENTRIES = 10_000;

function pruneRateLimits() {
  const now = Date.now();
  for (const [ip, entry] of requestCounts) {
    if (entry.resetAt <= now) requestCounts.delete(ip);
  }
}
setInterval(pruneRateLimits, 60_000).unref();

app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Comprehensive Defensive Security Headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Permissions-Policy", "camera=*, microphone=(), geolocation=()");
  // Protect against clickjacking while allowing verified same-origin and AI Studio frames
  const frameAncestors =
    process.env["NODE_ENV"] === "production"
      ? "frame-ancestors 'self' https:;"
      : "frame-ancestors 'self' https: http://localhost:* http://127.0.0.1:*;";
  res.setHeader("Content-Security-Policy", frameAncestors);
  next();
});

const appUrlOrigin = (() => {
  const raw = process.env["APP_URL"]?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

// Secure Cross-Origin Resource Sharing
app.use((req, res, next) => {
  const reqHost = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim().toLowerCase();
  const corsMiddleware = cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (configuredOrigins.length > 0 && configuredOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (appUrlOrigin && origin === appUrlOrigin) {
        return callback(null, true);
      }
      try {
        const parsed = new URL(origin);
        const hostname = parsed.hostname.toLowerCase();
        const originHost = parsed.host.toLowerCase();
        if (
          (reqHost && originHost === reqHost) ||
          hostname.endsWith(".run.app") ||
          hostname.endsWith(".ai.studio") ||
          hostname.endsWith(".aistudio.google.com") ||
          (process.env["NODE_ENV"] !== "production" &&
            (hostname === "localhost" || hostname === "127.0.0.1"))
        ) {
          return callback(null, true);
        }
      } catch {
        return callback(null, false);
      }
      return callback(null, false);
    },
    credentials: true,
  });
  return corsMiddleware(req, res, next);
});

// Tatum & Paystack sign the exact raw bytes they send. Capture these routes before
// the JSON parser so webhook handlers can verify signatures safely.
app.use("/api/crypto/webhooks/tatum", express.raw({ type: "application/json", limit: "100kb" }));
app.use("/api/paystack/webhooks", express.raw({ type: "application/json", limit: "100kb" }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Rate limiter with bounds protection
app.use("/api", (req, res, next) => {
  const now = Date.now();
  const key = req.ip ?? "unknown";
  
  if (requestCounts.size >= MAX_RATE_LIMIT_ENTRIES) {
    pruneRateLimits();
  }

  const record = requestCounts.get(key);
  if (!record || record.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }
  if (record.count >= RATE_LIMIT) {
    res.setHeader("Retry-After", Math.ceil((record.resetAt - now) / 1000));
    return res.status(429).json({ message: "Too many requests. Try again shortly." });
  }
  record.count += 1;
  return next();
});

app.use("/api", router);

// Catch any unhandled /api requests and return clean JSON 404 instead of falling through to Vite HTML
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Endpoint not found", path: req.originalUrl });
});

export default app;
