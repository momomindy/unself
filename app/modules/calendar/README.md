# calendar 模块

日历模块，本期做「编辑日程」：读取一条日程、按版本号乐观锁改字段、通过变更流提示他人改动。

## 目录

- `src/`：worker 入口、认证、路由、事件读写与校验
- `frontend/`：Vue 前端，含 409 对比横幅与 3 秒轮询提示
- `test/`：真 SQLite 跑真迁移的路由级集成测试
- `migrations/calendar/`：D1 迁移
- `scripts/build.mjs`：打包、校验 manifest

## 接口

- `PATCH /api/events/:id`：改字段，必带 `version`；200 回 `{ event, version }`，409 回 `{ error: version_conflict, event, version, actorName }`
- `GET /api/events/:id`：读详情，软删一律 404。归模块自有：变更流只给 eventId，撞车对比必须靠它取完整日程；后续查组若有详情接口再统一口径。
- `GET /api/changes?since=`：变更流，`since` 含当毫秒，cursor 只前进，单次上限 200
- `GET /api/health`、`GET /life/export`、`POST /life/purge`：平台约定接口

## 运行

```bash
pnpm --filter @unself/calendar dev
```

前端：

```bash
pnpm --filter @unself/calendar-frontend dev
```

真接口模式需在工作台或 `frontend/public/dev-shim.html` 里打开，由壳注入 token。

本地 D1 不会自动跑迁移，需先执行 `migrations/calendar/0001_events.sql` 并插入测试行。

### 查询接口本地联调

以下步骤使用 Wrangler 的本地 Worker 和 D1，不需要 Cloudflare 账号。先在项目根目录执行 `pnpm install --frozen-lockfile`，再进入 `app/modules/calendar`。本地配置复用 chat 模块安装的 Wrangler；样例是虚构数据。

仅对全新的 `.wrangler/query-demo` 依次执行一次：

```bash
../../modules/chat/node_modules/.bin/wrangler d1 execute DB --local --persist-to .wrangler/query-demo --file migrations/calendar/0001_events.sql --yes
```

```bash
../../modules/chat/node_modules/.bin/wrangler d1 execute DB --local --persist-to .wrangler/query-demo --file migrations/calendar/0002_event_exdates.sql --yes
```

```bash
../../modules/chat/node_modules/.bin/wrangler d1 execute DB --local --persist-to .wrangler/query-demo --file scripts/query-sample.sql --yes
```

上述命令是全新本地库的手动初始化，不做迁移记账；已执行过的 `0002` 不要重复执行。已有库或部署环境按正式迁移流程处理。

生成本机开发身份：

```bash
node frontend/scripts/dev-token.mjs
```

脚本打印的假壳地址带 token，只在本机使用；不要提交或分享 token、密钥和 `.dev.vars`。然后启动后端：

```bash
../../modules/chat/node_modules/.bin/wrangler dev --local --persist-to .wrangler/query-demo --ip 127.0.0.1 --port 8787
```

在另一个终端从项目根目录启动前端：

```bash
VITE_USE_MOCK=false pnpm --filter @unself/calendar-frontend dev
```

前端 Vite 默认将 `/api` 代理到同一台电脑的 8787 端口；通过开发身份脚本打印的假壳地址打开页面。查询页面的真实接口接线尚待与前端分支整合；前端目前仅在 mock 模式显示查询页面。已有编辑器固定读取 `demo-1`，样例没有这条记录。

查询样例可使用 `GET /api/events?from=1795622400000&to=1795708800000`（上海时间 2026-11-26）。登录后应查到跨天值班、全天培训、取消的会议和项目会议，已删除日程不出现。重复规则展开与例外日期按当前实现提供；iCal 订阅尚未实现。

PATCH 只允许改自己的日程：行上 `organizer_id` 必须等于 token 的 `sub`，否则 403。

## 校验与产物

```bash
pnpm --filter @unself/calendar typecheck
pnpm --filter @unself/calendar test
node scripts/build.mjs
```

## 部署变量

装容器注入 `MODULE_ID`（实例 id，也是 token 的 aud）、`CORE_JWKS_JSON`、可选 `CORE_ISSUER`；不注 `MODULE_ID` 时回落 `manifest.id`，仅本地调试用。
