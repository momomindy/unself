// SPDX-License-Identifier: AGPL-3.0-only
import ICAL from 'ical.js';
import { tzlib_get_ical_block } from 'timezones-ical-library';
import type { EventRow } from '../types';

export class FeedDataError extends Error {}

function localParts(ms: number, timezone: string): string {
  if (!Number.isSafeInteger(ms)) throw new FeedDataError('invalid_event_time');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

function addTime(event: ICAL.Component, name: string, ms: number, zone: string, tzid: string, allDay: boolean): void {
  const local = localParts(ms, zone);
  if (allDay && (ms % 1000 !== 0 || !local.endsWith('T00:00:00'))) throw new FeedDataError('invalid_all_day_boundary');
  const property = new ICAL.Property(name);
  property.setValue(ICAL.Time.fromString(allDay ? local.slice(0, 10) : local, property));
  if (!allDay) property.setParameter('tzid', tzid);
  event.addProperty(property);
}

export function serializeFeed(rows: EventRow[]): string {
  try {
    const calendar = new ICAL.Component('vcalendar');
    calendar.addPropertyWithValue('version', '2.0');
    calendar.addPropertyWithValue('prodid', '-//UN-Self//Calendar//EN');
    calendar.addPropertyWithValue('calscale', 'GREGORIAN');
    const zones = new Map<string, string>();
    for (const row of rows) {
      if (!row.uid || !row.title || row.start_at >= row.end_at || !['confirmed', 'tentative', 'cancelled'].includes(row.status)) {
        throw new FeedDataError('invalid_event');
      }
      // iCalendar 的 DATE-TIME 仅支持秒；无法表达小于一秒且落在同一秒内的时间段。
      if (!row.all_day && Math.floor(row.start_at / 1000) === Math.floor(row.end_at / 1000)) {
        throw new FeedDataError('event_duration_below_second');
      }
      let tzid = zones.get(row.timezone);
      if (!tzid) {
        const data = tzlib_get_ical_block(row.timezone);
        if (!Array.isArray(data) || !data[0]) throw new FeedDataError('unsupported_timezone');
        const zone = new ICAL.Component(ICAL.parse(data[0]));
        tzid = zone.getFirstPropertyValue('tzid') as string;
        if (!tzid) throw new FeedDataError('unsupported_timezone');
        calendar.addSubcomponent(zone);
        zones.set(row.timezone, tzid);
      }
      const event = new ICAL.Component('vevent');
      event.addPropertyWithValue('uid', row.uid);
      event.addPropertyWithValue('summary', row.title);
      event.addPropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(row.updated_at), true));
      event.addPropertyWithValue('status', row.status.toUpperCase());
      if (row.description !== null) event.addPropertyWithValue('description', row.description);
      if (row.location !== null) event.addPropertyWithValue('location', row.location);
      addTime(event, 'dtstart', row.start_at, row.timezone, tzid, row.all_day !== 0);
      addTime(event, 'dtend', row.end_at, row.timezone, tzid, row.all_day !== 0);
      if (row.rrule) {
        const rule = ICAL.Recur.fromString(row.rrule);
        if (row.all_day && rule.until && !rule.until.isDate) {
          if (rule.until.zone.tzid !== 'UTC') throw new FeedDataError('invalid_recurrence_until');
          // 原规则的 UNTIL 为 UTC 时刻，全天开始于当地午夜；转为同一时区的截止日期。
          const date = localParts(rule.until.toUnixTime() * 1000, row.timezone).slice(0, 10);
          rule.until = ICAL.Time.fromString(date, null);
        }
        event.addPropertyWithValue('rrule', rule);
      }
      const exdates: unknown = JSON.parse(row.exdates);
      if (!Array.isArray(exdates) || !exdates.every(Number.isSafeInteger)) throw new FeedDataError('invalid_exdates');
      for (const exdate of exdates as number[]) addTime(event, 'exdate', exdate, row.timezone, tzid, row.all_day !== 0);
      calendar.addSubcomponent(event);
    }
    return `${calendar.toString()}\r\n`;
  } catch (error) {
    if (error instanceof FeedDataError) throw error;
    throw new FeedDataError('invalid_event_data');
  }
}
