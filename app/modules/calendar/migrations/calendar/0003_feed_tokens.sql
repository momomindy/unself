-- SPDX-License-Identifier: AGPL-3.0-only
-- 每个用户在当前模块实例中最多保留一个订阅令牌，只保存令牌的 SHA-256 哈希。
CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
  user_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
