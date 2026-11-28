// SPDX-License-Identifier: AGPL-3.0-only
import type { Context } from 'hono';
import { requireAuth, type AppEnv } from '../auth';
import { isFeedTokenValid, replaceFeedToken, revokeFeedToken } from '../feed/tokens';
import { listFeedEvents } from '../feed/events';
import { FeedDataError, serializeFeed } from '../feed/serialize';

export async function createFeedToken(c: Context<AppEnv>): Promise<Response> {
  c.header('Cache-Control', 'no-store');
  const blocked = await requireAuth(c);
  if (blocked) return blocked;
  const token = await replaceFeedToken(c.env.DB, c.get('claims').sub);
  // 相对于模块根地址，外部地址由注册表确定，不能由请求 Host 推导。
  return c.json({ feedPath: `feed/${token}.ics` });
}

export async function deleteFeedToken(c: Context<AppEnv>): Promise<Response> {
  c.header('Cache-Control', 'no-store');
  const blocked = await requireAuth(c);
  if (blocked) return blocked;
  await revokeFeedToken(c.env.DB, c.get('claims').sub);
  return c.json({ ok: true });
}

export async function getFeed(c: Context<AppEnv>): Promise<Response> {
  c.header('Cache-Control', 'no-store');
  const filename = c.req.param('filename') ?? '';
  if (!filename.endsWith('.ics') || !await isFeedTokenValid(c.env.DB, filename.slice(0, -4))) {
    return c.notFound();
  }
  try {
    const body = serializeFeed(await listFeedEvents(c.env.DB));
    c.header('Content-Type', 'text/calendar; charset=utf-8');
    return c.body(body);
  } catch (error) {
    if (error instanceof FeedDataError) return c.json({ error: error.message }, 500);
    throw error;
  }
}
