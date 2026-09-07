import { getDb } from "./db";
import { PLANS, type PlanId } from "./plans";

export interface UserRow {
  clerk_id: string;
  stripe_customer_id: string | null;
  plan: PlanId;
  extra_credits: number;
  created_at: number;
}

export function ensureUser(clerkId: string): UserRow {
  const db = getDb();
  const existing = db
    .prepare(`SELECT * FROM users WHERE clerk_id = ?`)
    .get(clerkId) as UserRow | undefined;
  if (existing) return existing;
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (clerk_id, plan, extra_credits, created_at) VALUES (?, 'free', 0, ?)`,
  ).run(clerkId, now);
  return {
    clerk_id: clerkId,
    stripe_customer_id: null,
    plan: "free",
    extra_credits: 0,
    created_at: now,
  };
}

export function getUser(clerkId: string): UserRow | null {
  return (
    (getDb().prepare(`SELECT * FROM users WHERE clerk_id = ?`).get(clerkId) as
      | UserRow
      | undefined) ?? null
  );
}

export function getUserByStripeCustomer(customerId: string): UserRow | null {
  return (
    (getDb()
      .prepare(`SELECT * FROM users WHERE stripe_customer_id = ?`)
      .get(customerId) as UserRow | undefined) ?? null
  );
}

export function setStripeCustomer(clerkId: string, customerId: string) {
  ensureUser(clerkId);
  getDb()
    .prepare(`UPDATE users SET stripe_customer_id = ? WHERE clerk_id = ?`)
    .run(customerId, clerkId);
}

export function setUserPlan(clerkId: string, plan: PlanId) {
  ensureUser(clerkId);
  getDb().prepare(`UPDATE users SET plan = ? WHERE clerk_id = ?`).run(plan, clerkId);
}

export function addCredits(clerkId: string, n: number) {
  ensureUser(clerkId);
  getDb()
    .prepare(`UPDATE users SET extra_credits = extra_credits + ? WHERE clerk_id = ?`)
    .run(n, clerkId);
}

export function consumeCredit(clerkId: string): boolean {
  ensureUser(clerkId);
  const res = getDb()
    .prepare(
      `UPDATE users SET extra_credits = extra_credits - 1 WHERE clerk_id = ? AND extra_credits > 0`,
    )
    .run(clerkId);
  return res.changes > 0;
}

export function monthlyUsage(clerkId: string): number {
  const start = startOfMonthMs();
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM usage_events WHERE clerk_id = ? AND created_at >= ?`,
    )
    .get(clerkId, start) as { c: number };
  return row.c;
}

export function recordUsage(clerkId: string, kind: string) {
  getDb()
    .prepare(`INSERT INTO usage_events (clerk_id, kind, created_at) VALUES (?, ?, ?)`)
    .run(clerkId, kind, Date.now());
}

export function startOfMonthMs(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function planLimits(plan: PlanId) {
  return PLANS[plan] ?? PLANS.free;
}
