<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script setup lang="ts">
import 'temporal-polyfill/global'
import '@schedule-x/theme-default/dist/index.css'
import { createCalendar, viewMonthGrid, viewWeek } from '@schedule-x/calendar'
import { createEventsServicePlugin } from '@schedule-x/events-service'
import { ScheduleXCalendar } from '@schedule-x/vue'
import { watch } from 'vue'
import type { EventOccurrence } from '../lib/query-api'

const props = defineProps<{
  view: 'month' | 'week'
  date: Temporal.PlainDate
  events: EventOccurrence[]
  timezone: string
}>()
const emit = defineEmits<{ select: [occurrence: EventOccurrence] }>()
const eventsService = createEventsServicePlugin()
const occurrencesById = new Map<string, EventOccurrence>()
const calendar = createCalendar({
  views: [props.view === 'month' ? viewMonthGrid : viewWeek],
  selectedDate: props.date,
  timezone: props.timezone,
  locale: 'zh-CN',
  firstDayOfWeek: 1,
  isResponsive: false,
  skipAnimations: true,
  calendars: {
    query: {
      colorName: 'query',
      lightColors: {
        main: 'var(--unself-color-primary)',
        container: 'var(--unself-color-primary-soft)',
        onContainer: 'var(--unself-color-text)',
      },
    },
  },
  callbacks: {
    onEventClick(event) {
      const occurrence = occurrencesById.get(String(event.id))
      if (occurrence) emit('select', occurrence)
    },
  },
}, [eventsService])

const zoned = (ms: number) => Temporal.Instant.fromEpochMilliseconds(ms)
  .toZonedDateTimeISO(props.timezone)

watch(() => props.events, occurrences => {
  occurrencesById.clear()
  eventsService.set(occurrences.map(item => {
    const id = `${item.eventId}-${item.occurrenceStartAt}`
    occurrencesById.set(id, item)
    const start = zoned(item.occurrenceStartAt)
    return {
      id,
      calendarId: 'query',
      title: item.event.title,
      start: item.event.allDay ? start.toPlainDate() : start,
      // Schedule-X's all-day end date is inclusive.
      end: item.event.allDay
        ? zoned(item.occurrenceEndAt - 1).toPlainDate()
        : zoned(item.occurrenceEndAt),
    }
  }))
}, { immediate: true })
</script>

<template>
  <div class="event-calendar">
    <ScheduleXCalendar :calendar-app="calendar" />
  </div>
</template>

<style scoped>
.event-calendar {
  --sx-color-primary: var(--unself-color-primary);
  --sx-color-primary-container: var(--unself-color-primary-soft);
  --sx-color-on-primary-container: var(--unself-color-text);
  --sx-color-surface: var(--unself-color-surface);
  --sx-color-surface-container: var(--unself-color-bg);
  --sx-color-background: var(--unself-color-bg);
  --sx-color-on-background: var(--unself-color-text);
  --sx-color-surface-dim: var(--unself-color-border);
  --sx-color-surface-container-low: var(--unself-color-surface-hover);
  --sx-color-surface-container-high: var(--unself-color-surface-active);
  --sx-color-on-surface: var(--unself-color-text);
  --sx-color-outline: var(--unself-color-border);
  --sx-color-outline-variant: var(--unself-color-border);
  display: none;
}

.event-calendar :deep(.sx__calendar-header) { display: none; }
.event-calendar :deep(.sx__calendar-wrapper) { border-radius: var(--unself-radius-lg); }
.event-calendar :deep(.sx__event) { border-radius: var(--unself-radius-sm); }

@media (min-width: 720px) {
  .event-calendar {
    --calendar-width: min(calc(100vw - var(--unself-space-8) * 2), calc(var(--unself-page-width) * 2));
    display: block;
    width: var(--calendar-width);
    margin-inline: calc((100% - var(--calendar-width)) / 2);
  }
}
</style>
