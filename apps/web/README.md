# @photo-calendar/web

原生 TypeScript + Vite 的纯静态展示站。没有前端框架，也没有服务端。

## 页面与 URL

- `index.html?month=YYYY-MM`：月历。月份缺失或非法时回退到当前月份并规范化 URL。
- `day.html?date=YYYY-MM-DD`：单日。日期非法时回退到今天并显示提示。
- 所有站内链接使用相对路径；`base` 为相对基路径，因此可部署在 GitHub Pages 子路径。

## 数据

运行时 `fetch` 同源 `data/calendar.json`。Vite 插件 `photo-calendar-data` 会：

- 开发时把仓库根 `data/` 映射到 `/data/`；
- 构建时把 `data/` 复制到 `apps/web/dist/data/`；
- 构建时读取 `updatedAt` 并注入 `__CALENDAR_VERSION__`，页面请求带 `?v=` 以避免慢缓存。

数据校验使用 `@photo-calendar/shared` 的 `parseManifestLenient`：单个条目无效或重复时跳过并保留其他条目，整个文件无效时全部按无照片处理。

## 无照片回退

`src/fallback/` 使用 FNV-1a 哈希，只依赖日期字符串与内容库：

```text
短语索引 = hash32(`${date}|phrase|v1`) % PHRASES.length
图样索引 = hash32(`${date}|pattern|v1`) % PATTERNS.length
seed     = hash32(`${date}|seed|v1`) || 1
```

内容库版本常量在 `src/fallback/phrases.ts`（`FALLBACK_CONTENT_VERSION`）中；修改库内容或顺序会改变某一天的结果。`css-doodle` 通过 `https://unpkg.com/css-doodle@0.38.4/css-doodle.min.js` 固定版本加载；脚本不可用时 2 秒后启用 `.pattern-fallback` 纯 CSS 背景。


## 视觉与主题

展示端以「相纸 / 拍立得」为核心视觉语言。CSS token 集中在 `src/styles.css` 的 `:root`，深色值由 `@media (prefers-color-scheme: dark)` 覆盖；页面声明 `color-scheme: light dark`，不提供手动主题开关。月历与单日页使用同一组 `--paper`、`--ink`、`--frame`、`--frame-ink`、`--stage`、`--copy-bg`、`--tape` 等变量，因此系统主题切换时两页保持一致。

- 月历日期格：`.day-cell` 内是 `span.day-print` 相纸，照片、日期章与短文案都在纸面内；无照片日期使用 `.day-print.is-empty` 的虚线纸卡。
- 单日页：`.photo-paper` 承载不裁切的照片，`.day-copy` 是独立纸卡；无照片页使用 `.postcard-paper` 明信片卡。
- `index.html` 与 `day.html` 各有两个 `meta[name="theme-color"]`，分别带 light/dark media，值对应 `--paper`。
- 所有装饰用 CSS 渐变、边框、阴影和伪元素；旋转在移动端取消，装饰不拦截指针。`prefers-reduced-motion: reduce` 下过渡关闭。

## 命令

```bash
pnpm dev                 # 开发服务器
pnpm build               # 构建 dist/ 并复制 data/
pnpm test                # Vitest + jsdom
pnpm test:e2e            # Playwright；先执行 build
pnpm test:a11y           # Playwright + axe
```

Playwright 使用本机 Chrome（`channel: 'chrome'`）与 `tests/support/serve.mjs` 在 `/photo-calendar/` 子路径下提供 `dist/`，覆盖子路径、移动端、键盘、CDN 阻断与无照片回退。

## 目录

```text
index.html / day.html    两个入口页
src/main-month.ts         月历入口
src/main-day.ts           单日入口
src/month.ts              月历渲染
src/day.ts                单日渲染
src/data.ts               数据加载与降级
src/fallback/             固定寄语、图样与确定性选择
src/meta.ts               标题/OG 元数据
src/doodle.ts             css-doodle 加载与降级
src/styles.css            全部样式
```
