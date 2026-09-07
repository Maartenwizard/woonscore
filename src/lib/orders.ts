import { getDb } from "./db";

export interface ServiceOrderRow {
  id: number;
  clerk_id: string;
  dienst_id: string;
  dienst_naam: string;
  adres: string;
  nummeraanduiding_id: string | null;
  amount_cents: number;
  status: "pending" | "paid" | "canceled";
  stripe_session_id: string | null;
  created_at: number;
  paid_at: number | null;
}

export function createOrder(opts: {
  clerkId: string;
  dienstId: string;
  dienstNaam: string;
  adres: string;
  nummeraanduidingId?: string;
  amountCents: number;
}): number {
  const res = getDb()
    .prepare(
      `INSERT INTO service_orders
         (clerk_id, dienst_id, dienst_naam, adres, nummeraanduiding_id, amount_cents, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(
      opts.clerkId,
      opts.dienstId,
      opts.dienstNaam,
      opts.adres,
      opts.nummeraanduidingId ?? null,
      opts.amountCents,
      Date.now(),
    );
  return Number(res.lastInsertRowid);
}

export function attachStripeSession(orderId: number, sessionId: string) {
  getDb()
    .prepare(`UPDATE service_orders SET stripe_session_id = ? WHERE id = ?`)
    .run(sessionId, orderId);
}

export function markOrderPaid(orderId: number): boolean {
  const res = getDb()
    .prepare(
      `UPDATE service_orders SET status = 'paid', paid_at = ? WHERE id = ? AND status != 'paid'`,
    )
    .run(Date.now(), orderId);
  return res.changes > 0;
}

export function listOrders(clerkId: string): ServiceOrderRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM service_orders WHERE clerk_id = ? ORDER BY created_at DESC LIMIT 50`,
    )
    .all(clerkId) as ServiceOrderRow[];
}
