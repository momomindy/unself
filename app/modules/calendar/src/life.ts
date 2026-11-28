// SPDX-License-Identifier: AGPL-3.0-only
import type { Context } from 'hono';
import { requireAuth, type AppEnv } from './auth';
import type { ChangeRow, EventRow } from './types';

/** 生命周期端点（docs/modules.md §9）：导出与清库，认证同业务接口。 */

export async function exportData(c: Context<AppEnv>): Promise<Response> {
  const blocked = await requireAuth(c);
  if (blocked) return blocked;

  const events = await c.env.DB.prepare(
    'SELECT * FROM calendar_events ORDER BY created_at ASC',
  ).all<EventRow>();
  const changes = await c.env.DB.prepare(
    'SELECT * FROM calendar_event_changes ORDER BY created_at ASC',
  ).all<ChangeRow>();
  const feedTokens = await c.env.DB.prepare(
    'SELECT user_id, token_hash, created_at FROM calendar_feed_tokens ORDER BY user_id ASC',
  ).all<{ user_id: string; token_hash: string; created_at: number }>();

  return c.json({
    version: 1,
    moduleId: 'calendar',
    exportedAt: new Date().toISOString(),
    tables: {
      calendar_events: { schemaVersion: 1, rows: events.results },
      calendar_event_changes: { schemaVersion: 1, rows: changes.results },
      calendar_feed_tokens: { schemaVersion: 1, rows: feedTokens.results },
    },
    files: [],
  });
}

export async function purgeData(c: Context<AppEnv>): Promise<Response> {
  const blocked = await requireAuth(c);
  if (blocked) return blocked;

  // D1 batch 在单一事务中执行；失败时整批回滚，重试可继续清理。
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM calendar_feed_tokens'),
    c.env.DB.prepare('DELETE FROM calendar_event_changes'),
    c.env.DB.prepare('DELETE FROM calendar_events'),
  ]);
  return c.json({ ok: true });
}
