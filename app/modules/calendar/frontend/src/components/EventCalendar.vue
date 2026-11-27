<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script setup lang="ts">
import 'temporal-polyfill/global'
import '@schedule-x/theme-default/dist/index.css'
import { createCalendar, viewMonthGrid, viewWeek } from '@schedule-x/calendar'
import { createEventsServicePlugin } from '@schedule-x/events-service'
import { createScrollControllerPlugin } from '@schedule-x/scroll-controller'
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
const plugins = props.view === 'week'
  ? [eventsService, createScrollControllerPlugin({ initialScroll: '08:00' })]
  : [eventsService]
const occurrencesById = new Map<string, EventOccurrence>()
const calendar = createCalendar({
  views: [props.view === 'month' ? viewMonthGrid : viewWeek],
  selectedDate: props.date,
  timezone: props.timezone,
  locale: 'zh-CN',
  firstDayOfWeek: 1,
  isResponsive: false,
  skipAnimations: true,
  // Compress the full-day grid uniformly so Schedule-X keeps labels and events aligned.
  ...(props.view === 'week' ? { weekOptions: { gridHeight: 1200 } } : {}),
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
}, plugins)

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
  <div class="event-calendar" :class="{ 'event-calendar--week': view === 'week' }">
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

.event-calendar--week :deep(.sx__week-grid__date) {
  padding-block: var(--unself-space-1);
  gap: calc(var(--unself-space-1) / 2);
}

.event-calendar--week :deep(.sx__week-grid__date-number) {
  font-size: var(--unself-font-size-base);
  inline-size: var(--unself-space-5);
  block-size: var(--unself-space-5);
}

.event-calendar--week :deep(.sx__time-grid-event),
.event-calendar--week :deep(.sx__date-grid-event) {
  padding-block: calc(var(--unself-space-1) / 2);
  padding-inline: var(--unself-space-1);
  font-size: var(--unself-font-size-2xs);
  line-height: var(--unself-space-4);
}

.event-calendar--week :deep(.sx__time-grid-event-title) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-calendar--week :deep(.sx__title-and-time-compact) {
  gap: var(--unself-space-1);
}

.event-calendar--week :deep(.sx__date-grid-cell) {
  height: var(--unself-space-4);
}

@media (min-width: 720px) {
  .event-calendar { display: block; }

  .event-calendar--week {
    block-size: min(var(--unself-page-height), 70dvh);
  }

  .event-calendar--week :deep(.sx-vue-calendar-wrapper) {
    block-size: 100%;
  }

  .event-calendar--week :deep(.sx__view-container) {
    overflow-anchor: none;
    scroll-behavior: auto;
  }
}
</style>
