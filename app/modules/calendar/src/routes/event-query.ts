// SPDX-License-Identifier: AGPL-3.0-only
import type { Context } from 'hono';
import { requireAuth, type AppEnv } from '../auth';
import { queryEvents, QueryError } from '../events/query';

export async function listEvents(c: Context<AppEnv>): Promise<Response> {
  const blocked = await requireAuth(c);
  if (blocked) return blocked;
  const fromRaw = c.req.query('from');
  const toRaw = c.req.query('to');
  if (!fromRaw || !toRaw || !/^-?\d+$/.test(fromRaw) || !/^-?\d+$/.test(toRaw)) return c.json({ error: 'range_invalid' }, 400);
  const from = Number(fromRaw);
  const to = Number(toRaw);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || Math.abs(from) > 8640000000000000 || Math.abs(to) > 8640000000000000 || from >= to) return c.json({ error: 'range_invalid' }, 400);
  try {
    const events = await queryEvents(c.env.DB, from, to, (c.req.query('keyword') ?? '').trim());
    return c.json({ events });
  } catch (error) {
    if (error instanceof QueryError) {
      if (error.message === 'too_many_events') return c.json({ error: error.message, limit: 500 }, 400);
      if (error.message === 'recurrence_too_complex') return c.json({ error: error.message }, 400);
      return c.json({ error: error.message }, 500);
    }
    throw error;
  }
}
