# Tasks

## 1. 单日 DOM 结构

- [x] 1.1 重构 `renderPhotoDay`：在 `figure.photo-paper` 内生成 `figcaption.photo-paper-note`，依次放入眉标、`h1#day-heading`、星期与 `p#caption.day-caption`，删除 `.day-copy` 与 `.photo-paper-mark`；验证 `pnpm --filter @photo-calendar/web test` 中更新后的单日单元测试通过
- [x] 1.2 更新 `apps/web/src/day.test.ts`：断言文案与日期位于同一相纸 `figcaption`、照片日不再生成 `.day-copy`、`aria-labelledby` 仍指向唯一的 `h1#day-heading`，回退日结构不变；验证该测试文件通过

## 2. 相纸白边与响应式布局

- [x] 2.1 调整 `styles.css` 的 `.photo-paper` / `.photo-paper-note`：相纸宽度随照片收缩（`fit-content` + `contain: inline-size`，420–920px 上下限）、可增长底部白边、日期与星期同一行、照片 `max-height` 与旋转内边距；验证 1440px 下白边同时容纳日期与 3 行文案且照片不裁切
- [x] 2.2 调整 `.day-view` 布局与 `.day-photo-stage` 溢出策略，让白边增高时舞台随内容增长而不裁切相纸；验证文案块与相纸包围盒都落在舞台内、无文字被 `overflow` 截断
- [x] 2.3 补齐移动端规则（320/375px 的宽度、照片高度、文案字号与内边距）；验证 Playwright 中 375px 单日页无横向滚动、文案可见
- [x] 2.4 更新 `apps/web/tests/e2e/calendar.spec.ts` 的单日断言：文案位于 `figure.photo-paper` 内、`.day-copy` 数量为 0、相纸高度比照片至少多 40px（白边存在）；验证 `pnpm --filter @photo-calendar/web test:e2e -- tests/e2e/calendar.spec.ts` 通过

## 3. 手写字体与马克笔质感

- [x] 3.1 在 `apps/web/day.html` 增加 `preconnect` 与 `cn-fontsource-hongleixingshu-regular@1.0.7/font.css` 样式表（`#handwriting-font`），且不在 `index.html` 引入；验证月历页无该样式表、无照片日期不生成 `.day-caption`
- [x] 3.2 在 `styles.css` 增加 `--marker-ink`、`--marker-bleed`、`--marker-line` token 与 `.day-caption` 回退字体栈、字号/行高、轻微旋转、渗墨阴影和手绘下划线，并添加 `.handwriting-ready` 的洪蕾行书规则；验证激活后计算样式包含 `hongleixingshu`、未激活时为系统楷体/衬线，深浅主题下墨色与纸边对比度达到 WCAG AA
- [x] 3.3 补充字体加载失败路径：先以回退字体渲染，等字体样式表就绪且 `document.fonts.load()` 成功后才加 `.handwriting-ready`；在 Playwright 中阻断 `https://cdn.jsdelivr.net/**` 后验证文案仍可见、类未激活且页面可用
- [x] 3.4 用 120 字文案夹具验证最长文案在桌面与 375px 下正常换行、白边增高、照片与文字均不裁切，且页面无横向滚动

## 4. 可访问性与文档

- [x] 4.1 更新 `docs/visual-language.md` 的单日结构与 token 表（手写文案、白边签名区、字体回退），验证文档描述与最终 DOM/CSS 一致
- [x] 4.2 更新 `docs/visual-acceptance.md` 的单日验收条目（白边文案、手写字体、长文案与窄屏），验证验收项都有对应测试或截图记录
- [x] 4.3 运行 `pnpm --filter @photo-calendar/web test:a11y`，验证浅色与深色照片日、回退日均无 serious/critical axe 违规

## 5. 集成验收

- [x] 5.1 运行 `pnpm check` 并定位结果：lint、格式、类型检查、Web 单元测试与构建通过；根级命令仅因编辑器既有的发布按钮未挂载而失败，已确认与本变更无关，按约定另开变更处理
- [x] 5.2 运行 `pnpm test:e2e`，验证月历、单日、主题、响应式与字体降级场景全部通过
- [x] 5.3 在 320/375/1440px 与浅色/深色下截图检查照片日与最长文案，确认照片仍是主体、白边比例自然、字迹可读、无横向滚动

## Workflow follow-up

- 另开变更修复 `apps/editor/src/main.ts` 中未挂载的发布卡片，恢复根级 `pnpm check` 的编辑器测试；本变更以 `pnpm check:web` 与 `pnpm test:a11y` 作为 Web 验收。
- 评审通过后归档该变更，并按项目惯例同步 `calendar-display` 主规格。
- 归档后复查主规格与视觉文档，确认后续变更以本版单日相纸结构为基线。
