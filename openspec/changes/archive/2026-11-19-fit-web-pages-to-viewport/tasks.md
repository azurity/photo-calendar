# Tasks

## 1. 月历页收进视口

- [x] 1.1 在 `styles.css` 建立月历视口高度链（`.month-page`、`.page-main`、`#app`、`.month-view`、`.month-grid-wrap` 的 flex/min-height），把 `.month-grid` 行高改为 `minmax(78px, 1fr)`（移动端 `minmax(56px, 1fr)`），移除 `.day-cell` 固定 `min-height`；验证 1440×900 下 2026-11（6 行）`scrollHeight <= innerHeight`、所有日期格高度一致且 ≥44×44
- [x] 1.2 收紧 `.site-footer` 间距并在 `max-height: 760px` 下隐藏装饰页脚；验证 375×667 与 320×667 月历无纵向滚动且日期格可触控

## 2. 单日页收进视口

- [x] 2.1 调整桌面单日页：`.day-photo` 上限改为 `min(52vh, 720px)`，收紧 stage/navigation/main 的垂直留白；验证 1440×900 与 1440×1000 常规文案下 `scrollHeight <= innerHeight`、照片与文案不裁切
- [x] 2.2 调整移动端单日页：`.day-photo` 上限改为 `min(38vh, 360px)` 并收紧间距；验证 375×667 与 320×667 常规文案下无纵向/横向滚动，照片仍是主体
- [x] 2.3 用 120 字文案验证超长内容：允许页面纵向滚动，但 `scrollWidth <= innerWidth`、文案文本完整、文案与照片包围盒都在相纸/舞台内，不出现裁切

## 3. 视口回归测试

- [x] 3.1 在 `apps/web/tests/e2e/calendar.spec.ts` 增加页面高度断言：月历（2026-11）与单日页（2026-11-15）在 1440×900、375×667、320×667 下 `scrollHeight <= innerHeight + 1` 且无横向滚动；验证 `pnpm --filter @photo-calendar/web test:e2e -- tests/e2e/calendar.spec.ts` 通过
- [x] 3.2 检查 `apps/web/tests/e2e/theme.spec.ts` 的月历等高行/视口断言；如固定行高假设失效，改为比较行高相等，验证 `pnpm --filter @photo-calendar/web test:e2e -- tests/e2e/theme.spec.ts` 通过

## 4. 文档与视觉验收

- [x] 4.1 更新 `docs/visual-language.md` 与 `docs/visual-acceptance.md`，记录视口高度链、短视口隐藏页脚与长文案滚动降级；验证文档描述与最终 CSS/测试一致
- [x] 4.2 在 1440×900 与 375×667 的浅色/深色下截取月历与单日页，保存到 `artifacts/visual/`，确认日期格可读、照片主体与手写文案未被压扁或裁切

## 5. 集成验收

- [x] 5.1 运行 `pnpm check:web`，验证类型检查、单元测试、构建与全部 Web E2E 通过
- [x] 5.2 运行 `pnpm test:a11y`，验证月历、单日页与回退页在浅色/深色下无 serious/critical axe 违规

## Workflow follow-up

- 评审通过后归档该变更，并把「视口内完整呈现」要求同步进 `calendar-display` 主规格。
- 若后续加入新的页头内容或更高月份行数，重新检查 1440×900 与 375×667 的页面高度预算。
