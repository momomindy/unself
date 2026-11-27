-- SPDX-License-Identifier: AGPL-3.0-only
-- 重复例外：JSON 数组，保存跳过的每次发生的原始开始时间（UTC 毫秒）。
-- 已有日程默认没有例外；此迁移按文件名记账，只执行一次。
ALTER TABLE calendar_events ADD COLUMN exdates TEXT NOT NULL DEFAULT '[]';
