// SPDX-License-Identifier: AGPL-3.0-only

/** 令牌采用 256 位随机数，十六进制表示可直接用于 URL 路径。 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashFeedToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

/** 每次生成都替换该用户的旧令牌；明文只返回给调用方。 */
export async function replaceFeedToken(db: D1Database, userId: string): Promise<string> {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await hashFeedToken(token);
  await db.prepare(`INSERT INTO calendar_feed_tokens (user_id, token_hash, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at`)
    .bind(userId, hash, Date.now()).run();
  return token;
}

export async function revokeFeedToken(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM calendar_feed_tokens WHERE user_id = ?').bind(userId).run();
}

export async function isFeedTokenValid(db: D1Database, token: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const hash = await hashFeedToken(token);
  const row = await db.prepare('SELECT user_id FROM calendar_feed_tokens WHERE token_hash = ?')
    .bind(hash).first<{ user_id: string }>();
  return row !== null;
}
