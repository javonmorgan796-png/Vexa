import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getClientIp } from "./lib/rateLimit";

const app: Express = express();
// Trust the immediate reverse proxy (Cloud Run / AI Studio) so req.ip and req.protocol
// reflect the real client IP and HTTPS scheme without trusting client-spoofed headers.
app.set("trust proxy", 1);

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

const supabaseOrigins = (() => {
  const raw = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "").trim();
  if (!raw) return ["https://*.supabase.co", "wss://*.supabase.co"];
  try {
    const parsed = new URL(raw);
    const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return [parsed.origin, `${wsProtocol}//${parsed.host}`, "https://*.supabase.co", "wss://*.supabase.co"];
  } catch {
    return ["https://*.supabase.co", "wss://*.supabase.co"];
  }
})();

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

// Comprehensive Defensive Security Headers & Full Content-Security-Policy
app.use((req, res, next) => {
  const isProd = process.env["NODE_ENV"] === "production";
  const isHttps = req.secure || req.header("x-forwarded-proto")?.split(",")[0]?.trim() === "https";

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  if (isProd && isHttps) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const scriptSrc = isProd
    ? "script-src 'self';"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval';";
  const connectSrc = [
    "'self'",
    ...supabaseOrigins,
    ...(isProd ? [] : ["ws://localhost:*", "ws://127.0.0.1:*", "http://localhost:*", "http://127.0.0.1:*"]),
  ].join(" ");
  const frameAncestors = isProd
    ? "frame-ancestors 'self' https://aistudio.google.com https://*.aistudio.google.com https://*.ai.studio;"
    : "frame-ancestors 'self' https: http://localhost:* http://127.0.0.1:*;";

  const cspDirectives = [
    "default-src 'self';",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com;",
    "img-src 'self' data: blob: https://img.logo.dev;",
    "media-src 'self' blob:;",
    `connect-src ${connectSrc};`,
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    frameAncestors,
  ];
  res.setHeader("Content-Security-Policy", cspDirectives.join(" "));
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

// Strict Cross-Origin Resource Sharing (no blanket wildcard PaaS subdomain trust in production)
app.use((req, res, next) => {
  const reqHost = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim().toLowerCase();
  const isProd = process.env["NODE_ENV"] === "production";
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
        // Same-host requests (including custom domains, vexa42.ai.studio, Cloud Run service host)
        if (reqHost && originHost === reqHost && (parsed.protocol === "https:" || !isProd)) {
          return callback(null, true);
        }
        // Only allow localhost and AI Studio dev origins outside production
        if (
          !isProd &&
          (hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname === "aistudio.google.com" ||
            hostname.endsWith(".aistudio.google.com"))
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

// Prevent caching of sensitive financial, authentication, or administrative API responses
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Rate limiter with bounds protection using trusted proxy req.ip
app.use("/api", (req, res, next) => {
  const now = Date.now();
  const key = getClientIp(req);

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
