import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";
import { ensureUser, planLimits } from "./users";

export interface ApiKeyRow {
  id: number;
  clerk_id: string;
  prefix: string;
  hash: string;
  name: string | null;
  created_at: number;
  last_used_at: number | null;
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `ws_${randomBytes(24).toString("base64url")}`;
  return { raw, prefix: raw.slice(0, 10), hash: hashApiKey(raw) };
}

export function listKeys(clerkId: string): ApiKeyRow[] {
  return getDb()
    .prepare(
      `SELECT id, clerk_id, prefix, hash, name, created_at, last_used_at
       FROM user_api_keys WHERE clerk_id = ? ORDER BY created_at DESC`,
    )
    .all(clerkId) as ApiKeyRow[];
}

export function createKey(
  clerkId: string,
  name?: string,
): { raw: string; prefix: string } | { error: string } {
  const user = ensureUser(clerkId);
  const limits = planLimits(user.plan);
  const count = (
    getDb().prepare(`SELECT COUNT(*) as c FROM user_api_keys WHERE clerk_id = ?`).get(clerkId) as {
      c: number;
    }
  ).c;
  if (count >= limits.maxKeys) {
    return { error: `Maximaal ${limits.maxKeys} API-keys op het ${limits.name}-plan` };
  }
  const { raw, prefix, hash } = generateApiKey();
  getDb()
    .prepare(
      `INSERT INTO user_api_keys (clerk_id, prefix, hash, name, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(clerkId, prefix, hash, name ?? "Standaard", Date.now());
  return { raw, prefix };
}

export function revokeKey(clerkId: string, id: number): boolean {
  const res = getDb()
    .prepare(`DELETE FROM user_api_keys WHERE id = ? AND clerk_id = ?`)
    .run(id, clerkId);
  return res.changes > 0;
}

export function lookupKey(raw: string): ApiKeyRow | null {
  const hash = hashApiKey(raw);
  return (
    (getDb()
      .prepare(`SELECT * FROM user_api_keys WHERE hash = ?`)
      .get(hash) as ApiKeyRow | undefined) ?? null
  );
}

export function touchKey(id: number) {
  getDb().prepare(`UPDATE user_api_keys SET last_used_at = ? WHERE id = ?`).run(Date.now(), id);
}
