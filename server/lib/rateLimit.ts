import type { Request, Response, NextFunction } from "express";

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

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const store = new Map<string, Bucket>();
  stores.push(store);
  const MAX_ENTRIES = 10_000;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (store.size >= MAX_ENTRIES) {
      for (const [k, v] of store) {
        if (v.resetAt <= now) store.delete(k);
      }
    }

    const ip =
      req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      "unknown";
    const key = options.keyGenerator ? options.keyGenerator(req) : ip;
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
  windowMs: 60_000,
  max: 15,
  message: "Too many authentication requests. Please try again in a minute.",
});

export const otpRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 6,
  message: "Too many verification code requests. Please wait a minute.",
});

export const pinRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  message: "Too many PIN verification attempts. Please wait a minute.",
});

export const resolveAccountRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 25,
  message: "Too many bank account lookup requests. Please slow down.",
});

export const adminAuthRateLimiter = createRateLimiter({
  windowMs: 5 * 60_000,
  max: 15,
  message: "Too many administrative authentication attempts. Please wait a few minutes.",
});
