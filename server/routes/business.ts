import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  extractBearerToken,
  isSupabaseAdminConfigured,
  isUuid,
  supabaseRest,
  supabaseRpc,
  verifySupabasePassword,
  verifySupabaseUser,
} from "../lib/supabaseAdmin";
import {
  hasCustomBusinessPin,
  hashPin,
  verifyBusinessPin,
} from "../lib/pinSecurity";
import { pinRateLimiter } from "../lib/rateLimit";

const router: IRouter = Router();

function roundMoney(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function genBizAccountNumber(): string {
  return "8" + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
}

function genBizRef(): string {
  return "VBX" + Date.now().toString(36).toUpperCase() + randomBytes(2).toString("hex").toUpperCase();
}

async function requireAuth(req: Request, res: Response) {
  if (!isSupabaseAdminConfigured()) {
    res.status(503).json({ message: "Database admin service is not configured" });
    return null;
  }
  const user = await verifySupabaseUser(extractBearerToken(req));
  if (!user) {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
    return null;
  }
  return user;
}

async function getOwnedBusiness(ownerId: string): Promise<Record<string, unknown> | null> {
  const res = await supabaseRest(
    `business_accounts?owner_id=eq.${encodeURIComponent(ownerId)}&select=*&limit=1`,
  );
  if (!res.ok) return null;
  const rows = (await res.json().catch(() => [])) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

async function checkOwnerAccountSecurity(ownerId: string): Promise<string | null> {
  const [pRes, sRes] = await Promise.all([
    supabaseRest(`profiles?id=eq.${encodeURIComponent(ownerId)}&select=is_suspended&limit=1`),
    supabaseRest(`account_security_state?user_id=eq.${encodeURIComponent(ownerId)}&select=sleep_mode_active,freeze_active&limit=1`),
  ]);
  if (pRes.ok) {
    const rows = (await pRes.json().catch(() => [])) as Array<{ is_suspended?: boolean }>;
    if (rows[0]?.is_suspended) return "Your Vexa account is currently suspended.";
  }
  if (sRes.ok) {
    const rows = (await sRes.json().catch(() => [])) as Array<{ sleep_mode_active?: boolean; freeze_active?: boolean }>;
    if (rows[0]?.freeze_active) return "Freeze Account is active. Money movement is blocked.";
    if (rows[0]?.sleep_mode_active) return "Sleep Mode is active. Money movement is blocked.";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Business Security (Hashed 6-digit Business PIN + Lockout — Never Exposed)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/business/security/status", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  let resDb = await supabaseRest(
    `business_security?user_id=eq.${encodeURIComponent(authUser.id)}&select=pin,pin_hash,attempts,locked_until&limit=1`,
  );
  if (!resDb.ok) {
    resDb = await supabaseRest(
      `business_security?user_id=eq.${encodeURIComponent(authUser.id)}&select=pin,attempts,locked_until&limit=1`,
    );
  }
  if (!resDb.ok) {
    return res.status(503).json({ message: "Could not read business security state." });
  }

  const rows = (await resDb.json().catch(() => [])) as Array<{
    pin?: string | null;
    pin_hash?: string | null;
    attempts?: number | null;
    locked_until?: string | null;
  }>;
  const row = rows[0];
  if (!row) {
    return res.json({ hasCustomPin: false, attempts: 0, lockedUntil: null });
  }
  return res.json({
    hasCustomPin: hasCustomBusinessPin(row),
    attempts: Number(row.attempts ?? 0),
    lockedUntil: row.locked_until ? new Date(row.locked_until).getTime() : null,
  });
});

router.post("/business/security/verify-pin", pinRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
  const result = await verifyBusinessPin(authUser.id, pin);
  if (!result.ok) {
    return res.status(result.nowLocked ? 429 : 422).json({
      success: false,
      error: result.error || "Incorrect PIN.",
      attempts: result.attempts,
      lockedUntil: result.lockedUntil,
      nowLocked: Boolean(result.nowLocked),
    });
  }

  return res.json({
    success: true,
    attempts: 0,
    lockedUntil: null,
  });
});

router.post("/business/security/reset-pin", pinRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const passcode = typeof req.body?.passcode === "string" ? req.body.passcode.trim() : "";
  const newPin = typeof req.body?.newPin === "string" ? req.body.newPin.trim() : "";

  if (!passcode) {
    return res.status(400).json({ message: "Account passcode verification is required." });
  }
  if (!/^\d{6}$/.test(newPin)) {
    return res.status(400).json({ message: "Business PIN must be exactly 6 digits." });
  }

  // Verify the caller's actual Supabase login passcode on the server before resetting the Business PIN
  let email = authUser.email;
  if (!email) {
    const pRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}&select=email,phone&limit=1`);
    const pRows = pRes.ok ? ((await pRes.json().catch(() => [])) as Array<{ email?: string; phone?: string }>) : [];
    email = pRows[0]?.email || (pRows[0]?.phone ? `${pRows[0].phone}@vexa.app` : "");
  }
  if (!email || !(await verifySupabasePassword(email, passcode))) {
    return res.status(403).json({ message: "Incorrect account passcode." });
  }

  const upsertModern = await supabaseRest("business_security?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: authUser.id,
      pin: "",
      pin_hash: hashPin(newPin),
      attempts: 0,
      locked_until: null,
    }),
  });
  if (!upsertModern.ok) {
    // Fallback if pin_hash column isn't added yet
    const upsertLegacy = await supabaseRest("business_security?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: authUser.id,
        pin: newPin,
        attempts: 0,
        locked_until: null,
      }),
    });
    if (!upsertLegacy.ok) {
      return res.status(500).json({ message: "Could not reset Business PIN." });
    }
  }

  return res.json({ success: true, attempts: 0, lockedUntil: null });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Business Account Management (Zero Client Balance Mutation)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/business/create", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const existing = await getOwnedBusiness(authUser.id);
  if (existing) {
    return res.status(409).json({ message: "A business account already exists for your profile." });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const businessName = typeof body.businessName === "string" ? body.businessName.trim().slice(0, 120) : "";
  const businessType = typeof body.businessType === "string" ? body.businessType.trim() : "sole_proprietorship";
  const allowedTypes = new Set(["sole_proprietorship", "partnership", "llc", "corporation"]);

  if (!businessName || !allowedTypes.has(businessType)) {
    return res.status(400).json({ message: "Valid business name and type are required." });
  }

  const insertRes = await supabaseRest("business_accounts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: authUser.id,
      business_name: businessName,
      business_type: businessType,
      industry: typeof body.industry === "string" ? body.industry.trim().slice(0, 80) : "",
      description: typeof body.description === "string" ? body.description.trim().slice(0, 400) : "",
      account_number: genBizAccountNumber(),
      balance: 0,
      owner_name: typeof body.ownerName === "string" ? body.ownerName.trim().slice(0, 100) : "Owner",
      owner_phone: typeof body.ownerPhone === "string" ? body.ownerPhone.trim().slice(0, 30) : authUser.phone || "",
      email: typeof body.email === "string" ? body.email.trim().slice(0, 160) : authUser.email || "",
      address: typeof body.address === "string" ? body.address.trim().slice(0, 250) : "",
      two_fa_enabled: false,
      transaction_limit: 5000000,
      notifications_enabled: true,
    }),
  });

  if (!insertRes.ok) {
    return res.status(500).json({ message: "Business account could not be saved." });
  }
  const rows = (await insertRes.json().catch(() => [])) as Array<Record<string, unknown>>;
  return res.json({ success: true, business: rows[0] ?? null });
});

router.patch("/business/update", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  // Strictly allow settings fields; NEVER allow balance or owner_id
  if (typeof body.businessName === "string" && body.businessName.trim()) {
    patch.business_name = body.businessName.trim().slice(0, 120);
  }
  if (typeof body.industry === "string") patch.industry = body.industry.trim().slice(0, 80);
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 400);
  if (typeof body.email === "string") patch.email = body.email.trim().slice(0, 160);
  if (typeof body.address === "string") patch.address = body.address.trim().slice(0, 250);
  if (typeof body.twoFAEnabled === "boolean") patch.two_fa_enabled = body.twoFAEnabled;
  if (typeof body.notificationsEnabled === "boolean") patch.notifications_enabled = body.notificationsEnabled;
  if (typeof body.transactionLimit === "number" && Number.isFinite(body.transactionLimit) && body.transactionLimit >= 1000 && body.transactionLimit <= 100_000_000) {
    patch.transaction_limit = roundMoney(body.transactionLimit);
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ message: "No valid business settings provided." });
  }

  const updateRes = await supabaseRest(`business_accounts?id=eq.${encodeURIComponent(String(business.id))}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!updateRes.ok) {
    return res.status(500).json({ message: "Failed to update business settings." });
  }
  const rows = (await updateRes.json().catch(() => [])) as Array<Record<string, unknown>>;
  return res.json({ success: true, business: rows[0] ?? null });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Employees & Payroll Schedules (Owner-Verified on Backend)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/business/employees", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 100) : "";
  const salary = roundMoney(Number(b.salary ?? 0));
  if (!name || !Number.isFinite(salary) || salary < 0 || salary > 100_000_000) {
    return res.status(400).json({ message: "Valid employee name and salary are required." });
  }

  const insertRes = await supabaseRest("employees", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      business_id: business.id,
      name,
      role: typeof b.role === "string" ? b.role.trim().slice(0, 80) : "",
      department: typeof b.department === "string" ? b.department.trim().slice(0, 80) : "",
      salary,
      account_number: typeof b.accountNumber === "string" ? b.accountNumber.replace(/\D/g, "").slice(0, 10) : "",
      bank_name: typeof b.bankName === "string" ? b.bankName.trim().slice(0, 100) : "",
      email: typeof b.email === "string" ? b.email.trim().slice(0, 160) : "",
      phone: typeof b.phone === "string" ? b.phone.trim().slice(0, 30) : "",
      start_date: typeof b.startDate === "string" ? b.startDate.trim().slice(0, 40) : "",
      app_role: ["admin", "manager", "employee", "viewer"].includes(String(b.appRole)) ? b.appRole : "employee",
      active: b.active !== false,
    }),
  });
  if (!insertRes.ok) return res.status(500).json({ message: "Could not add employee." });
  const rows = (await insertRes.json().catch(() => [])) as Array<Record<string, unknown>>;
  return res.json({ success: true, employee: rows[0] ?? null });
});

router.patch("/business/employees/:id", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: "Invalid employee ID." });

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 100);
  if (typeof b.role === "string") patch.role = b.role.trim().slice(0, 80);
  if (typeof b.department === "string") patch.department = b.department.trim().slice(0, 80);
  if (typeof b.salary === "number" && Number.isFinite(b.salary) && b.salary >= 0) patch.salary = roundMoney(b.salary);
  if (typeof b.accountNumber === "string") patch.account_number = b.accountNumber.replace(/\D/g, "").slice(0, 10);
  if (typeof b.bankName === "string") patch.bank_name = b.bankName.trim().slice(0, 100);
  if (typeof b.email === "string") patch.email = b.email.trim().slice(0, 160);
  if (typeof b.phone === "string") patch.phone = b.phone.trim().slice(0, 30);
  if (typeof b.startDate === "string") patch.start_date = b.startDate.trim().slice(0, 40);
  if (["admin", "manager", "employee", "viewer"].includes(String(b.appRole))) patch.app_role = b.appRole;
  if (typeof b.active === "boolean") patch.active = b.active;

  const updateRes = await supabaseRest(
    `employees?id=eq.${encodeURIComponent(id)}&business_id=eq.${encodeURIComponent(String(business.id))}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    },
  );
  if (!updateRes.ok) return res.status(500).json({ message: "Could not update employee." });
  const rows = (await updateRes.json().catch(() => [])) as Array<Record<string, unknown>>;
  return res.json({ success: true, employee: rows[0] ?? null });
});

router.delete("/business/employees/:id", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: "Invalid employee ID." });

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const delRes = await supabaseRest(
    `employees?id=eq.${encodeURIComponent(id)}&business_id=eq.${encodeURIComponent(String(business.id))}`,
    { method: "DELETE" },
  );
  if (!delRes.ok) return res.status(500).json({ message: "Could not delete employee." });
  return res.json({ success: true });
});

router.post("/business/schedules", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 100) : "";
  const frequency = typeof b.frequency === "string" ? b.frequency : "monthly";
  if (!name || !["monthly", "biweekly", "weekly"].includes(frequency)) {
    return res.status(400).json({ message: "Valid schedule name and frequency are required." });
  }

  const employeeIds = Array.isArray(b.employeeIds)
    ? b.employeeIds.filter((x): x is string => typeof x === "string" && isUuid(x))
    : [];

  const insertRes = await supabaseRest("payroll_schedules", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      business_id: business.id,
      name,
      frequency,
      next_run_date: typeof b.nextRunDate === "string" ? b.nextRunDate.trim().slice(0, 40) : "",
      employee_ids: employeeIds,
      active: b.active !== false,
    }),
  });
  if (!insertRes.ok) return res.status(500).json({ message: "Could not create payroll schedule." });
  const rows = (await insertRes.json().catch(() => [])) as Array<Record<string, unknown>>;
  return res.json({ success: true, schedule: rows[0] ?? null });
});

router.patch("/business/schedules/:id", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: "Invalid schedule ID." });

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 100);
  if (["monthly", "biweekly", "weekly"].includes(String(b.frequency))) patch.frequency = b.frequency;
  if (typeof b.nextRunDate === "string") patch.next_run_date = b.nextRunDate.trim().slice(0, 40);
  if (Array.isArray(b.employeeIds)) {
    patch.employee_ids = b.employeeIds.filter((x): x is string => typeof x === "string" && isUuid(x));
  }
  if (typeof b.active === "boolean") patch.active = b.active;

  const updateRes = await supabaseRest(
    `payroll_schedules?id=eq.${encodeURIComponent(id)}&business_id=eq.${encodeURIComponent(String(business.id))}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    },
  );
  if (!updateRes.ok) return res.status(500).json({ message: "Could not update schedule." });
  const rows = (await updateRes.json().catch(() => [])) as Array<Record<string, unknown>>;
  return res.json({ success: true, schedule: rows[0] ?? null });
});

router.delete("/business/schedules/:id", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: "Invalid schedule ID." });

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const delRes = await supabaseRest(
    `payroll_schedules?id=eq.${encodeURIComponent(id)}&business_id=eq.${encodeURIComponent(String(business.id))}`,
    { method: "DELETE" },
  );
  if (!delRes.ok) return res.status(500).json({ message: "Could not delete schedule." });
  return res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Business Payroll, Transfers & Bills (Atomic Server-Side Balance Debit)
// ─────────────────────────────────────────────────────────────────────────────

async function debitBusinessBalance(
  ownerId: string,
  business: Record<string, unknown>,
  amount: number,
  description: string,
  category: "payroll" | "transfer" | "bills" | "other",
  enforceLimit = false,
) {
  const ref = genBizRef();
  const rpcResp = await supabaseRpc("debit_business_balance_srv", {
    p_owner_id: ownerId,
    p_business_id: String(business.id),
    p_amount: amount,
    p_description: description.slice(0, 160),
    p_category: category,
    p_reference: ref,
    p_enforce_limit: enforceLimit,
  });

  if (!rpcResp.ok) {
    const errBody = (await rpcResp.json().catch(() => null)) as {
      message?: string;
      code?: string;
    } | null;
    const errMsg = errBody?.message || "Could not debit business balance.";
    const lower = errMsg.toLowerCase();

    if (
      rpcResp.status === 404 ||
      errBody?.code === "PGRST202" ||
      errBody?.code === "42883" ||
      lower.includes("could not find the function")
    ) {
      return {
        ok: false,
        status: 503,
        message: "Atomic business settlement RPC is not provisioned yet. Please run supabase-security-migration.sql.",
      };
    }
    if (lower.includes("suspended") || lower.includes("freeze") || lower.includes("sleep")) {
      return { ok: false, status: 403, message: errMsg };
    }
    if (lower.includes("not found")) {
      return { ok: false, status: 404, message: errMsg };
    }
    if (lower.includes("insufficient") || lower.includes("limit") || lower.includes("valid")) {
      return { ok: false, status: 400, message: errMsg };
    }
    return { ok: false, status: 422, message: errMsg };
  }

  const data = (await rpcResp.json().catch(() => null)) as {
    balance?: number;
    transaction?: Record<string, unknown> | null;
  } | null;

  return {
    ok: true,
    newBalance: Number(data?.balance ?? 0),
    transaction: data?.transaction ?? null,
  };
}

router.post("/business/payroll/run", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const lockErr = await checkOwnerAccountSecurity(authUser.id);
  if (lockErr) return res.status(403).json({ message: lockErr });

  const scheduleId = typeof req.body?.scheduleId === "string" ? req.body.scheduleId.trim() : "";
  if (!isUuid(scheduleId)) return res.status(400).json({ message: "Invalid schedule ID." });

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const [schedRes, empRes] = await Promise.all([
    supabaseRest(
      `payroll_schedules?id=eq.${encodeURIComponent(scheduleId)}&business_id=eq.${encodeURIComponent(String(business.id))}&select=*&limit=1`,
    ),
    supabaseRest(
      `employees?business_id=eq.${encodeURIComponent(String(business.id))}&active=eq.true&select=id,name,salary`,
    ),
  ]);
  const schedRows = schedRes.ok ? ((await schedRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
  const empRows = empRes.ok ? ((await empRes.json().catch(() => [])) as Array<{ id: string; salary: number }>) : [];
  const schedule = schedRows[0];
  if (!schedule) return res.status(404).json({ message: "Schedule not found." });

  const empIdSet = new Set(Array.isArray(schedule.employee_ids) ? (schedule.employee_ids as string[]) : []);
  const targets = empRows.filter((e) => empIdSet.has(e.id));
  const total = roundMoney(targets.reduce((sum, e) => sum + Math.max(0, Number(e.salary) || 0), 0));
  if (targets.length === 0 || total <= 0) {
    return res.status(400).json({ message: "No active employees with positive salary in this schedule." });
  }

  const debit = await debitBusinessBalance(authUser.id, business, total, `Payroll Run - ${String(schedule.name || "Schedule")}`, "payroll");
  if (!debit.ok) return res.status(debit.status || 400).json({ message: debit.message });

  return res.json({
    success: true,
    message: `₦${total.toLocaleString("en-NG")} paid to ${targets.length} employees`,
    balance: debit.newBalance,
    transaction: debit.transaction,
  });
});

router.post("/business/payroll/bulk", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const lockErr = await checkOwnerAccountSecurity(authUser.id);
  if (lockErr) return res.status(403).json({ message: lockErr });

  const employeeIds = Array.isArray(req.body?.employeeIds)
    ? req.body.employeeIds.filter((id: unknown): id is string => typeof id === "string" && isUuid(id))
    : [];
  if (employeeIds.length === 0) return res.status(400).json({ message: "Select at least one employee." });

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const empRes = await supabaseRest(
    `employees?business_id=eq.${encodeURIComponent(String(business.id))}&active=eq.true&select=id,name,salary`,
  );
  const empRows = empRes.ok ? ((await empRes.json().catch(() => [])) as Array<{ id: string; salary: number }>) : [];
  const selectedSet = new Set(employeeIds);
  const targets = empRows.filter((e) => selectedSet.has(e.id));
  const total = roundMoney(targets.reduce((sum, e) => sum + Math.max(0, Number(e.salary) || 0), 0));

  if (targets.length === 0 || total <= 0) {
    return res.status(400).json({ message: "No eligible active employees selected." });
  }

  const debit = await debitBusinessBalance(authUser.id, business, total, `Bulk Payroll (${targets.length} employees)`, "payroll");
  if (!debit.ok) return res.status(debit.status || 400).json({ message: debit.message });

  return res.json({
    success: true,
    message: `₦${total.toLocaleString("en-NG")} paid to ${targets.length} employees`,
    balance: debit.newBalance,
    transaction: debit.transaction,
  });
});

router.post("/business/transfer", pinRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const lockErr = await checkOwnerAccountSecurity(authUser.id);
  if (lockErr) return res.status(403).json({ message: lockErr });

  const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
  const amount = roundMoney(Number(req.body?.amount));
  const recipientName = typeof req.body?.recipientName === "string" ? req.body.recipientName.trim().slice(0, 120) : "";

  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    return res.status(400).json({ message: "Enter a valid transfer amount." });
  }
  if (!recipientName) {
    return res.status(400).json({ message: "Recipient name is required." });
  }

  const pinCheck = await verifyBusinessPin(authUser.id, pin);
  if (!pinCheck.ok) {
    return res.status(pinCheck.nowLocked ? 429 : 422).json({
      message: pinCheck.error || "Incorrect PIN.",
      attempts: pinCheck.attempts,
      lockedUntil: pinCheck.lockedUntil,
      nowLocked: Boolean(pinCheck.nowLocked),
    });
  }

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const limit = Number(business.transaction_limit ?? 5_000_000);
  if (amount > limit) {
    return res.status(400).json({ message: `Amount exceeds your business transaction limit of ₦${limit.toLocaleString("en-NG")}.` });
  }

  const debit = await debitBusinessBalance(authUser.id, business, amount, `Transfer to ${recipientName}`, "transfer", true);
  if (!debit.ok) return res.status(debit.status || 400).json({ message: debit.message });

  return res.json({
    success: true,
    balance: debit.newBalance,
    transaction: debit.transaction,
  });
});

router.post("/business/bills/pay", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const lockErr = await checkOwnerAccountSecurity(authUser.id);
  if (lockErr) return res.status(403).json({ message: lockErr });

  const categoryLabel = typeof req.body?.categoryLabel === "string" ? req.body.categoryLabel.trim().slice(0, 60) : "";
  const provider = typeof req.body?.provider === "string" ? req.body.provider.trim().slice(0, 80) : "";
  const amount = roundMoney(Number(req.body?.amount));

  if (!categoryLabel || !provider || !Number.isFinite(amount) || amount <= 0 || amount > 50_000_000) {
    return res.status(400).json({ message: "Valid bill provider and amount are required." });
  }

  const business = await getOwnedBusiness(authUser.id);
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const debit = await debitBusinessBalance(authUser.id, business, amount, `${categoryLabel} - ${provider}`, "bills");
  if (!debit.ok) return res.status(debit.status || 400).json({ message: debit.message });

  return res.json({
    success: true,
    balance: debit.newBalance,
    transaction: debit.transaction,
  });
});

export default router;
