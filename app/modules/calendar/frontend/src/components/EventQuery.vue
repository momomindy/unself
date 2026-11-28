<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script setup lang="ts">
import ICalSubscription from './ICalSubscription.vue'
import { computed, onMounted, ref } from 'vue'
import 'temporal-polyfill/global'
import EventCalendar from './EventCalendar.vue'
import type { CalendarEvent } from '../../../src/types'
import { AuthExpiredError, fetchEvent, fetchEventOccurrences } from '../lib/api'
import { isMock } from '../lib/mode'
import { listMockEvents, type EventOccurrence, type EventQueryParams } from '../lib/query-api'
import { fromZonedInput } from '../lib/time'

const QUERY_ZONE = 'Asia/Shanghai'
const DEFAULT_START = '2026-11-20'
const DEFAULT_END = '2026-11-21'
const start = ref(DEFAULT_START)
const end = ref(DEFAULT_END)
const keyword = ref('')
const appliedKeyword = ref('')
const view = ref<'month' | 'week' | 'list'>('month')
const anchor = ref(Temporal.PlainDate.from(DEFAULT_START))
const calendarWindow = computed(() => {
  const date = anchor.value
  if (view.value === 'week') {
    const first = date.subtract({ days: date.dayOfWeek - 1 })
    return { first, next: first.add({ weeks: 1 }) }
  }
  // Include the adjacent-month cells shown in the first and last rows.
  const monthStart = date.with({ day: 1 })
  const monthEnd = date.with({ day: date.daysInMonth })
  return {
    first: monthStart.subtract({ days: monthStart.dayOfWeek - 1 }),
    next: monthEnd.add({ days: 8 - monthEnd.dayOfWeek }),
  }
})
const occurrenceTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: QUERY_ZONE, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
})
const visibleEvents = computed(() => status.value === 'ready' ? events.value : [])
const events = ref<EventOccurrence[]>([])
const selected = ref<EventOccurrence | null>(null)
const detail = ref<CalendarEvent | null>(null)
const detailStatus = ref<'loading' | 'ready' | 'failed' | 'expired'>('ready')
const status = ref<'loading' | 'ready' | 'failed' | 'invalid' | 'expired'>('loading')
let requestId = 0
let detailRequestId = 0
let lastQuery: EventQueryParams | undefined

async function select(item: EventOccurrence): Promise<void> {
  const id = ++detailRequestId
  selected.value = item
  detail.value = null
  detailStatus.value = 'loading'
  try {
    const event = isMock() ? item.event : await fetchEvent(item.eventId)
    if (id !== detailRequestId) return
    detail.value = event
    detailStatus.value = 'ready'
  } catch (error) {
    if (id === detailRequestId) detailStatus.value = error instanceof AuthExpiredError ? 'expired' : 'failed'
  }
}

function clearSelection(): void {
  ++detailRequestId
  selected.value = null
  detail.value = null
}

async function runQuery(params: EventQueryParams): Promise<void> {
  const id = ++requestId
  lastQuery = params
  status.value = 'loading'
  clearSelection()
  try {
    const result = await (isMock() ? listMockEvents(params) : fetchEventOccurrences(params))
    if (id !== requestId) return
    events.value = result.events
    status.value = 'ready'
  } catch (error) {
    if (id === requestId) status.value = error instanceof AuthExpiredError ? 'expired' : 'failed'
  }
}

function submit(): void {
  appliedKeyword.value = keyword.value.trim()
  if (view.value === 'list') queryList()
  else queryCalendar()
}

function queryList(): void {
  const from = fromZonedInput(`${start.value}T00:00`, QUERY_ZONE)
  const endDay = Date.parse(`${end.value}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(endDay) || start.value > end.value) {
    ++requestId
    status.value = 'invalid'
    clearSelection()
    return
  }
  // Advance the calendar date before interpreting the next midnight in Shanghai.
  const nextDay = new Date(endDay)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  const nextMidnight = nextDay.toISOString().split('T')[0] + 'T00:00'
  const to = fromZonedInput(nextMidnight, QUERY_ZONE)
  void runQuery({ from, to, keyword: appliedKeyword.value })
}

function queryCalendar(): void {
  const { first, next } = calendarWindow.value
  void runQuery({
    from: first.toZonedDateTime(QUERY_ZONE).epochMilliseconds,
    to: next.toZonedDateTime(QUERY_ZONE).epochMilliseconds,
    keyword: appliedKeyword.value,
  })
}

function changeView(next: typeof view.value): void {
  if (next === view.value) return
  view.value = next
  if (next === 'list') queryList()
  else queryCalendar()
}

function navigate(direction: number): void {
  anchor.value = view.value === 'week'
    ? anchor.value.add({ weeks: direction })
    : anchor.value.add({ months: direction })
  queryCalendar()
}

function reset(): void {
  start.value = DEFAULT_START
  end.value = DEFAULT_END
  keyword.value = ''
  anchor.value = Temporal.PlainDate.from(DEFAULT_START)
  submit()
}

function retry(): void {
  if (lastQuery) void runQuery(lastQuery)
}

onMounted(submit)
</script>

<template>
  <section aria-labelledby="event-query-heading">
    <h2 id="event-query-heading">日程查询</h2>
    <ICalSubscription v-if="!isMock()" />
    <div class="query-controls" aria-label="日程视图">
      <button type="button" :aria-pressed="view === 'month'" @click="changeView('month')">月视图</button>
      <button type="button" :aria-pressed="view === 'week'" @click="changeView('week')">周视图</button>
      <button type="button" :aria-pressed="view === 'list'" @click="changeView('list')">日期范围列表</button>
    </div>
    <div v-if="view !== 'list'" class="query-controls calendar-navigation">
      <button type="button" @click="navigate(-1)">{{ view === 'month' ? '上个月' : '上一周' }}</button>
      <span>{{ calendarWindow.first }} 至 {{ calendarWindow.next.subtract({ days: 1 }) }}</span>
      <button type="button" @click="navigate(1)">{{ view === 'month' ? '下个月' : '下一周' }}</button>
    </div>
    <form @submit.prevent="submit">
      <p>查询日期按上海时区计算</p>
      <template v-if="view === 'list'">
        <p><label>开始日期 <input v-model="start" type="date" required /></label></p>
        <p><label>结束日期 <input v-model="end" type="date" required /></label></p>
      </template>
      <p><label>标题关键词 <input v-model="keyword" type="search" /></label></p>
      <div class="query-actions">
        <button type="submit">查询</button>
        <button type="button" @click="reset">重置</button>
      </div>
    </form>

    <p v-if="status === 'loading'" role="status">正在查询日程…</p>
    <p v-else-if="status === 'invalid'" role="alert">请选择有效日期，结束日期须在开始日期当天或之后。</p>
    <p v-else-if="status === 'expired'" role="alert">登录已过期，请重新登录。</p>
    <div v-else-if="status === 'failed'">
      <p role="alert">查询日程失败，请重试。</p>
      <button type="button" @click="retry">重试</button>
    </div>
    <p v-else-if="events.length === 0" role="status">没有符合条件的日程。</p>
    <ul v-if="visibleEvents.length" :class="{ 'narrow-list': view !== 'list' }">
      <li v-for="item in visibleEvents" :key="`${item.eventId}-${item.occurrenceStartAt}`">
        <button type="button" @click="select(item)">
          {{ item.event.title }} · {{ occurrenceTime.formatRange(item.occurrenceStartAt, item.occurrenceEndAt) }}
        </button>
      </li>
    </ul>
    <EventCalendar
      v-if="view !== 'list'"
      :key="`${view}-${anchor}`"
      :view="view"
      :date="anchor"
      :events="visibleEvents"
      :timezone="QUERY_ZONE"
      @select="select"
    />

    <div v-if="selected">
      <p v-if="detailStatus === 'loading'" role="status">正在加载日程详情…</p>
      <p v-else-if="detailStatus === 'expired'" role="alert">登录已过期，请重新登录。</p>
      <div v-else-if="detailStatus === 'failed'">
        <p role="alert">加载日程详情失败。</p>
        <button type="button" @click="select(selected)">重试详情</button>
      </div>
      <template v-else-if="detail">
        <h3>{{ detail.title }}</h3>
        <p>{{ occurrenceTime.formatRange(selected.occurrenceStartAt, selected.occurrenceEndAt) }}</p>
        <p>{{ detail.description }}</p>
        <p>地点：{{ detail.location }}</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.query-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--unself-space-2);
  margin-block: var(--unself-space-2);
}

button, input {
  font: inherit;
  color: var(--unself-color-text);
  background: var(--unself-color-surface);
  border: 1px solid var(--unself-color-border);
  border-radius: var(--unself-radius-md);
  padding: var(--unself-space-1) var(--unself-space-2);
}

button[aria-pressed="true"] {
  color: var(--unself-color-primary);
  background: var(--unself-color-primary-soft);
}

.query-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--unself-space-2);
  margin-block-end: var(--unself-space-4);
}

.narrow-list button {
  max-inline-size: 100%;
  overflow-wrap: anywhere;
}

@media (min-width: 720px) {
  .narrow-list { display: none; }

  .calendar-navigation {
    gap: var(--unself-space-1);
    margin-block: var(--unself-space-1);
    font-size: var(--unself-font-size-sm);
  }

  .calendar-navigation button {
    padding-inline: var(--unself-space-1);
  }

  .calendar-navigation span {
    font-variant-numeric: tabular-nums;
  }
}
</style>
