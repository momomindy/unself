// SPDX-License-Identifier: AGPL-3.0-only
import type { CalendarEvent } from '../../../src/types'
import { fetchEvent } from './api'

export interface EventQueryParams {
  from: number
  to: number
  keyword?: string
}

export interface EventOccurrence {
  eventId: string
  occurrenceStartAt: number
  occurrenceEndAt: number
  event: CalendarEvent
}

export interface EventQueryResult {
  events: EventOccurrence[]
}

let failNextQuery = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('mockQueryFail') === '1'

export async function listMockEvents(
  params: EventQueryParams,
): Promise<EventQueryResult> {
  const shouldFail = failNextQuery
  failNextQuery = false
  await new Promise<void>(resolve => setTimeout(resolve, 350))
  if (shouldFail) throw new Error('模拟日程查询失败')

  const first = await fetchEvent('demo-1')
  const second: CalendarEvent = {
    ...first,
    id: 'demo-2',
    uid: 'demo-2@example',
    title: '小组项目讨论',
    description: '确认日历查询的页面和接口',
    location: '图书馆讨论室',
    startAt: Date.parse('2026-11-21T06:00:00Z'),
    endAt: Date.parse('2026-11-21T07:00:00Z'),
  }

  const overnight: CalendarEvent = {
    ...second,
    id: 'demo-overnight',
    uid: 'demo-overnight@example',
    title: '跨午夜发布',
    description: '从 11 月 22 日深夜持续到次日凌晨',
    startAt: Date.parse('2026-11-22T23:30:00+08:00'),
    endAt: Date.parse('2026-11-23T00:30:00+08:00'),
  }
  const recurring: CalendarEvent = {
    ...second,
    id: 'demo-recurring',
    uid: 'demo-recurring@example',
    title: '每周进度同步',
    description: '同一日程的两次已展开实例',
    startAt: Date.parse('2026-11-19T10:00:00+08:00'),
    endAt: Date.parse('2026-11-19T11:00:00+08:00'),
  }
  const occurrences = [first, second, overnight, recurring].map(event => ({
    eventId: event.id,
    occurrenceStartAt: event.startAt,
    occurrenceEndAt: event.endAt,
    event,
  }))
  occurrences.push({
    eventId: recurring.id,
    occurrenceStartAt: Date.parse('2026-11-26T10:00:00+08:00'),
    occurrenceEndAt: Date.parse('2026-11-26T11:00:00+08:00'),
    event: recurring,
  })

  const keyword = params.keyword?.trim() ?? ''
  const events = occurrences
    .filter(item =>
      item.occurrenceStartAt < params.to &&
      item.occurrenceEndAt > params.from &&
      item.event.title.includes(keyword),
    )
    .sort((a, b) => a.occurrenceStartAt - b.occurrenceStartAt)

  return { events }
}
