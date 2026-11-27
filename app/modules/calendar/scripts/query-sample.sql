-- SPDX-License-Identifier: AGPL-3.0-only
-- 仅供本地开发。先依次应用 calendar 的 0001 和 0002 迁移。
-- INSERT OR IGNORE 不覆盖已有记录；如需重置，请使用全新的本地开发数据库。
-- 所有 ID、UID 和组织者均为样例；时间为 UTC 毫秒。

INSERT OR IGNORE INTO calendar_events
  (id, uid, title, location, start_at, end_at, all_day, timezone, organizer_id, status, version, created_at, updated_at, deleted_at, rrule, exdates)
VALUES
  -- 上海 11 月 26 日 09:00–10:00：关键词、普通查询。
  ('sample-query-meeting', 'sample-query-meeting@local.invalid', '项目会议', '会议室 A', 1795654800000, 1795658400000, 0, 'Asia/Shanghai', 'sample-user-a', 'confirmed', 1, 1795395600000, 1795395600000, NULL, NULL, '[]'),
  -- 相同开始时间：稳定排序；取消状态不是删除。
  ('sample-query-cancelled', 'sample-query-cancelled@local.invalid', '取消的会议', NULL, 1795654800000, 1795658400000, 0, 'Asia/Shanghai', 'sample-user-b', 'cancelled', 1, 1795395600000, 1795395600000, NULL, NULL, '[]'),
  -- 上海 11 月 25 日 23:00 至 26 日 01:00：跨天相交。
  ('sample-query-overnight', 'sample-query-overnight@local.invalid', '跨天值班', NULL, 1795618800000, 1795626000000, 0, 'Asia/Shanghai', 'sample-user-a', 'confirmed', 1, 1795395600000, 1795395600000, NULL, NULL, '[]'),
  -- 上海每周一 09:00，共四次；跳过 11 月 30 日这次。
  ('sample-query-weekly', 'sample-query-weekly@local.invalid', '每周例会', '会议室 B', 1795395600000, 1795399200000, 0, 'Asia/Shanghai', 'sample-user-a', 'confirmed', 1, 1795395600000, 1795395600000, NULL, 'FREQ=WEEKLY;COUNT=4;BYDAY=MO', '[1796000400000]'),
  -- 上海 11 月 26 日全天，结束边界为次日零点。
  ('sample-query-allday', 'sample-query-allday@local.invalid', '全天培训', NULL, 1795622400000, 1795708800000, 1, 'Asia/Shanghai', 'sample-user-a', 'confirmed', 1, 1795395600000, 1795395600000, NULL, NULL, '[]'),
  -- 纽约每周一 09:00，共三次，跨 2026 年 3 月夏令时切换。
  ('sample-query-dst', 'sample-query-dst@local.invalid', '纽约周会', NULL, 1772460000000, 1772463600000, 0, 'America/New_York', 'sample-user-b', 'confirmed', 1, 1772460000000, 1772460000000, NULL, 'FREQ=WEEKLY;COUNT=3;BYDAY=MO', '[]'),
  -- 上海 12 月 10 日 09:00–10:00：范围外过滤。
  ('sample-query-future', 'sample-query-future@local.invalid', '下月会议', NULL, 1796864400000, 1796868000000, 0, 'Asia/Shanghai', 'sample-user-a', 'confirmed', 1, 1795395600000, 1795395600000, NULL, NULL, '[]'),
  -- 已软删除：列表与详情均应排除。
  ('sample-query-deleted', 'sample-query-deleted@local.invalid', '已删除会议', NULL, 1795654800000, 1795658400000, 0, 'Asia/Shanghai', 'sample-user-a', 'confirmed', 1, 1795395600000, 1795395600000, 1795399200000, NULL, '[]');
