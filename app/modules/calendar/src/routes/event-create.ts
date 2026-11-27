// SPDX-License-Identifier: AGPL-3.0-only
import type { Context } from 'hono';
import { RRule } from 'rrule';
import { requireAuth, type AppEnv } from '../auth';
import { MAX_TITLE_LENGTH, rowToEvent, type EventRow } from '../types';

/** 创建接口适配现有日历表，身份由已验证的模块 token 提供。 */
export async function createEvent(c: Context<AppEnv>): Promise<Response> {
  const blocked = await requireAuth(c);
  if (blocked) return blocked;
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return c.json({ error: 'body_must_be_json' }, 400); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return c.json({ error: 'body_must_be_object' }, 400);
  const body = raw as Record<string, unknown>;
  const allowed = ['title', 'description', 'location', 'startAt', 'endAt', 'allDay', 'timezone', 'rrule'];
  for (const field of Object.keys(body)) if (!allowed.includes(field)) return c.json({ error: 'unknown_field', field }, 400);
  const fail = (field: string) => c.json({ error: 'invalid_field', field }, 400);
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > MAX_TITLE_LENGTH) return fail('title');
  for (const field of ['description', 'location'] as const) if (body[field] != null && typeof body[field] !== 'string') return fail(field);
  for (const field of ['startAt', 'endAt'] as const) if (typeof body[field] !== 'number' || !Number.isSafeInteger(body[field]) || Math.abs(body[field] as number) > 8640000000000000) return fail(field);
  const start = body.startAt as number, end = body.endAt as number;
  if (start >= end) return fail('endAt');
  if (typeof body.allDay !== 'boolean') return fail('allDay');
  if (typeof body.timezone !== 'string') return fail('timezone');
  try { new Intl.DateTimeFormat('en-US', { timeZone: body.timezone }); } catch { return fail('timezone'); }
  if (body.allDay) {
    const format = new Intl.DateTimeFormat('en-GB', { timeZone: body.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    if (format.format(new Date(start)) !== '00:00:00' || format.format(new Date(end)) !== '00:00:00' || start % 1000 !== 0 || end % 1000 !== 0) return fail('allDay');
  }
  if (body.rrule != null) {
    if (typeof body.rrule !== 'string' || !/^FREQ=[A-Z]+(?:;[A-Z]+=[A-Z0-9,+-]+)*$/i.test(body.rrule)) return fail('rrule');
    try { new RRule(RRule.parseString(body.rrule)); } catch { return fail('rrule'); }
  }
  const id = crypto.randomUUID(), now = Date.now();
  await c.env.DB.prepare(`INSERT INTO calendar_events
    (id, uid, title, description, location, start_at, end_at, all_day, timezone, organizer_id, rrule, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, `${id}@calendar`, body.title.trim(), body.description ?? null, body.location ?? null, start, end, body.allDay ? 1 : 0, body.timezone, c.get('claims').sub, body.rrule ?? null, now, now).run();
  const row = await c.env.DB.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first<EventRow>();
  if (!row) throw new Error('created_event_not_found');
  return c.json({ event: rowToEvent(row) }, 201);
}
