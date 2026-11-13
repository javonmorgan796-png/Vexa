import type { Request, Response, NextFunction } from "express";
import { consumeDistributedRateLimit } from "./securityStore";

interface Bucket {
  count: number;
  resetAt: number;
}

const stores: Array<Map<string, Bucket>> = [];

setInterval(() => {
  const now = Date.now();
  for (const store of stores) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }
}, 60_000).unref();

export function getClientIp(req: Request): string {
  // With `app.set("trust proxy", 1)`, req.ip accurately resolves the client IP
  // from the reverse proxy without honoring spoofed client-supplied X-Forwarded-For values.
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  prefix?: string;
  distributed?: boolean;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const store = new Map<string, Bucket>();
  stores.push(store);
  const MAX_ENTRIES = 10_000;

  return async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = options.keyGenerator ? options.keyGenerator(req) : getClientIp(req);
    const key = options.prefix ? `${options.prefix}:${rawKey}` : rawKey;

    if (options.distributed) {
      const result = await consumeDistributedRateLimit(key, options.max, options.windowMs);
      if (!result.allowed) {
        res.setHeader("Retry-After", String(result.retryAfterSec));
        return res.status(429).json({
          message:
            options.message ||
            `Too many requests. Please wait ${result.retryAfterSec}s before trying again.`,
        });
      }
      return next();
    }

    const now = Date.now();
    if (store.size >= MAX_ENTRIES) {
      for (const [k, v] of store) {
        if (v.resetAt <= now) store.delete(k);
      }
    }

    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (entry.count >= options.max) {
      const waitSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(waitSec));
      return res.status(429).json({
        message: options.message || `Too many requests. Please wait ${waitSec}s before trying again.`,
      });
    }

    entry.count += 1;
    return next();
  };
}

export const authRateLimiter = createRateLimiter({
  prefix: "auth",
  distributed: true,
  windowMs: 60_000,
  max: 15,
  message: "Too many authentication requests. Please try again in a minute.",
});

export const otpRateLimiter = createRateLimiter({
  prefix: "otp",
  distributed: true,
  windowMs: 60_000,
  max: 6,
  message: "Too many verification code requests. Please wait a minute.",
});

export const pinRateLimiter = createRateLimiter({
  prefix: "pin",
  distributed: true,
  windowMs: 60_000,
  max: 10,
  message: "Too many PIN verification attempts. Please wait a minute.",
});

export const resolveAccountRateLimiter = createRateLimiter({
  prefix: "resolve_acct",
  distributed: true,
  windowMs: 60_000,
  max: 25,
  message: "Too many bank account lookup requests. Please slow down.",
});

export const adminAuthRateLimiter = createRateLimiter({
  prefix: "admin_auth",
  distributed: true,
  windowMs: 5 * 60_000,
  max: 15,
  message: "Too many administrative authentication attempts. Please wait a few minutes.",
});
