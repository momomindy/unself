// SPDX-License-Identifier: AGPL-3.0-only
import type { EventRow } from '../types';

/** 订阅使用原始事件，由日历客户端按规则展开；软删除事件不输出。 */
export async function listFeedEvents(db: D1Database): Promise<EventRow[]> {
  const result = await db.prepare(
    'SELECT * FROM calendar_events WHERE deleted_at IS NULL ORDER BY start_at, id',
  ).all<EventRow>();
  return result.results;
}
