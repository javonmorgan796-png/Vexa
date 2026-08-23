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
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(cors({
  origin: configuredOrigins.length
    ? (origin, callback) => {
        if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed"));
      }
    : false,
  credentials: false,
}));
// Tatum signs the exact bytes it sends. Capture this route before the JSON
// parser so the webhook handler can verify x-payload-hash correctly.
app.use("/api/crypto/webhooks/tatum", express.raw({ type: "application/json", limit: "100kb" }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use("/api", (req, res, next) => {
  const now = Date.now();
  const key = req.ip ?? "unknown";
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

export default app;
