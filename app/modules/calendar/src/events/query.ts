// SPDX-License-Identifier: AGPL-3.0-only
import { RRule } from 'rrule';
import { rowToEvent, type CalendarEvent, type EventRow } from '../types';

export interface EventOccurrence {
  eventId: string;
  occurrenceStartAt: number;
  occurrenceEndAt: number;
  event: CalendarEvent;
}

export class QueryError extends Error {}

/** 从 UTC 时刻取得日程时区的本地时间，供 RRULE 按当地时钟展开。 */
function localClock(ms: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const value = (name: string) => Number(parts.find((p) => p.type === name)?.value);
  return Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'), ((ms % 1000) + 1000) % 1000);
}

function localToUtc(clock: number, timezone: string): number {
  let result = clock;
  for (let i = 0; i < 4; i++) result += clock - localClock(result, timezone);
  return result;
}

/** 所有日程共用同一个窗口、关键词与软删除规则。 */
export async function queryEvents(db: D1Database, from: number, to: number, keyword: string): Promise<EventOccurrence[]> {
  const rows = await db.prepare(`SELECT * FROM calendar_events
    WHERE deleted_at IS NULL AND status != 'cancelled' AND start_at < ?
      AND (rrule IS NOT NULL OR end_at > ?)
      AND instr(title, ?) > 0`).bind(to, from, keyword).all<EventRow>();
  const occurrences: EventOccurrence[] = [];
  for (const row of rows.results) {
    const event = rowToEvent(row);
    const append = (start: number, end: number) => {
      if (start < to && end > from) {
        occurrences.push({ eventId: row.id, occurrenceStartAt: start, occurrenceEndAt: end, event });
        if (occurrences.length > 500) throw new QueryError('too_many_events');
      }
    };
    if (!row.rrule) {
      append(row.start_at, row.end_at);
      continue;
    }
    try {
      const excluded: unknown = JSON.parse(row.exdates);
      if (!Array.isArray(excluded) || !excluded.every(Number.isSafeInteger)) throw new Error('invalid exdates');
      if (!/^FREQ=[A-Z]+(?:;[A-Z]+=[A-Z0-9,+-]+)*$/i.test(row.rrule)) throw new Error('invalid rule');
      const options = RRule.parseString(row.rrule);
      const startClock = localClock(row.start_at, row.timezone);
      const localDuration = localClock(row.end_at, row.timezone) - startClock;
      const duration = row.end_at - row.start_at;
      // RRULE 只计算本地钟面，避免其 TZID 实现依赖运行机器的时区。
      // UNTIL 是 UTC 时刻，在转换回真实时刻后再判断。
      const until = options.until?.getTime();
      // COUNT 按有效发生次数计数；跳过不存在的当地时间时不能消耗次数。
      const rule = new RRule({ ...options, count: undefined, until: undefined, dtstart: new Date(startClock) });
      let candidates = 0;
      let validCount = 0;
      // 全天事件跨夏令时时实际长度会变化，多留两天以覆盖窗口左边界。
      const lookback = row.all_day ? Math.max(duration, localDuration) + 172800000 : duration;
      const margin = 172800000;
      const windowStart = options.count == null ? from - lookback - margin : startClock;
      rule.between(new Date(Math.max(-8640000000000000, windowStart)), new Date(Math.min(8640000000000000, to + margin)), true, (date) => {
        if (++candidates > 100000) throw new QueryError('recurrence_too_complex');
        const start = localToUtc(date.getTime(), row.timezone);
        if (localClock(start, row.timezone) !== date.getTime()) return true;
        if (until !== undefined && start > until) return false;
        validCount++;
        if (!excluded.includes(start)) {
          const end = row.all_day ? localToUtc(localClock(start, row.timezone) + localDuration, row.timezone) : start + duration;
          append(start, end);
        }
        return options.count == null || validCount < options.count;
      });
    } catch (error) {
      if (error instanceof QueryError) throw error;
      throw new QueryError('invalid_recurrence');
    }
  }
  occurrences.sort((a, b) => a.occurrenceStartAt - b.occurrenceStartAt || (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0));
  return occurrences;
}
