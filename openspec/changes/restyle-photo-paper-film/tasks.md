# Tasks

## 1. 展示端主题基础

- [x] 1.1 重构 `apps/web/src/styles.css` 的语义 token：浅色与 `@media (prefers-color-scheme: dark)` 深色各一套，声明 `color-scheme: light dark`，移除 `.day-page` 固定深色；验证：新增主题 Playwright 断言在浅/深色下读到不同的 `--paper`，且两页 `color-scheme` 均为 `light dark`
- [x] 1.2 在 `apps/web/index.html` 与 `apps/web/day.html` 增加浅色/深色两条 `meta[name="theme-color"]`，与 token 配色一致；验证：Playwright 检查两页各有两条带 media 的主题色 meta，且值分别匹配浅/深背景
- [x] 1.3 建立 Web 主题测试辅助（`tests/e2e/theme.spec.ts` 或等价）覆盖浅/深切换、`emulateMedia` 与两页一致性；验证：`pnpm --filter @photo-calendar/web test:e2e -- theme` 通过
- [x] 1.4 在 `apps/web/README.md` 记录主题机制（系统偏好、token 层、主题色 meta）；验证：README 描述的 token 名称与 CSS 实际一致，命令可直接运行

## 2. 月历相纸化

- [x] 2.1 调整 `apps/web/src/month.ts` 的日期格结构：增加 `day-print` 展示性包裹与日期章，保留 `.day-cell`、`.day-thumb`、日期链接与 `aria-current`；验证：现有 `month.test.ts` 与月历 E2E 全绿，日期格仍可键盘聚焦
- [x] 2.2 在 `styles.css` 实现月历相纸网格、纸边、轻旋转、阴影、胶带/打孔与日期章，移动端取消旋转；验证：375px 与 1440px 下无横向滚动，装饰 `pointer-events: none` 且不遮挡日号/缩略图
- [x] 2.3 处理有照片/无照片/照片加载失败三种日期格的相纸层级，保留 `.is-blank` 补位不可点击；验证：月历 E2E 覆盖三种状态，axe 无 serious/critical 违规
- [x] 2.4 更新月历视觉测试或截图断言（结构/尺寸而非像素基线）；验证：新增断言覆盖相纸容器存在、触控区不小于 44×44、照片 `alt` 仍完整

## 3. 单日页与回退相纸化

- [x] 3.1 调整 `apps/web/src/day.ts`：为照片增加 `figure.photo-paper`（保留 `.day-photo`），文案保持在独立纸卡；验证：`day.test.ts` 与单日 E2E 全绿，照片 `alt`、相邻导航与标题不变
- [x] 3.2 在 `styles.css` 实现单日相纸主图、纸卡文案、日期/星期章与暗房背景；验证：浅/深主题下照片完整显示、不裁切、不溢出，文案对比度抽查通过
- [x] 3.3 将无照片单日页改为明信片/相纸寄语卡，保留 `fallback-phrase`、`fallback-meta` 与 css-doodle 层；验证：无照片 E2E 与 CDN 阻断测试通过，寄语仍为视觉主体
- [x] 3.4 更新 `apps/web/README.md` 的单日页视觉说明，记录相纸层与回退卡关系；验证：文档与 `day.ts`/CSS 结构一致

## 4. Web 响应式、可访问性与验收

- [x] 4.1 补齐 320px、375px、1440px 的相纸布局与触控约束，限制旋转/阴影/胶带在容器内；验证：Playwright 在三种视口断言无横向滚动、日期格 bounding box 不小于 44×44
- [x] 4.2 为浅色/深色分别运行 axe，检查焦点、对比度、非颜色状态与图片替代文本；验证：`pnpm test:a11y` 及新增深色主题 axe 用例通过
- [x] 4.3 验证 `prefers-reduced-motion: reduce` 下相纸悬停/主题过渡被关闭或缩短；验证：Playwright 断言过渡时长接近 0，页面内容完整
- [x] 4.4 生成浅色/深色、月历/单日/回退页截图作为验收附件，检查相纸装饰不遮挡内容；验证：截图文件存在且人工检查通过，不引入像素快照基线

## 5. 编辑器胶片主题基础

- [x] 5.1 重构 `apps/editor/src/styles.css` 的颜色/材质 token 为暗房胶片体系（暖黑、深棕、琥珀强调、安全灯红、胶片齿孔色），保留现有字号与间距尺度；验证：`pnpm check:editor` 通过，编辑器主视图 axe 无 serious/critical 违规
- [x] 5.2 将应用壳、侧栏、品牌、导航、发布卡片改为暗房工作台样式，增加必要的展示性 class 但不改变按钮/导航语义；验证：现有编辑器 UI 测试全绿，截图确认侧栏与主区层级清晰
- [x] 5.3 为胶片纹理/齿孔/阴影补充 `prefers-reduced-motion` 与焦点样式；验证：键盘焦点在侧栏、按钮、输入框上可见，减少动态效果下无装饰动画

## 6. 编辑器图库接触印样

- [x] 6.1 在 `apps/editor/src/main.ts` 的图库增加接触印样容器/帧号展示钩子，保留 `.photo-card`、`.photo-thumb`、日期与文案节点；验证：图库筛选/空状态 UI 测试全绿，帧号不进入可访问文本
- [x] 6.2 在 CSS 实现接触印样网格、相纸边、底片孔、帧号计数器与悬停层级；验证：900px 与 1200px 窗口无横向滚动，卡片仍可点击并有可见焦点
- [x] 6.3 处理筛选空状态、照片缺失与长文案在胶片卡片中的显示；验证：对应 UI/单元测试通过，截图确认信息不重叠

## 7. 编辑器导入、详情与设置

- [x] 7.1 将导入拖放区与草稿列表改为胶片条/单帧印样布局，保留日期、冲突、文案、生成与保存控件；验证：`app.test.ts` 的导入/冲突/保存用例全绿
- [x] 7.2 将详情主图改为放大印样/底片框，文案表单与元数据作为独立暗房记录卡；验证：详情编辑/删除/换一句测试通过，照片不裁切
- [x] 7.3 将设置表单、密钥面板、提示与确认弹窗改为统一的实验室标签页风格，保持字段标签与错误关联；验证：设置保存/密钥/axe 测试通过，所有输入仍可键盘操作
- [x] 7.4 更新 `docs/editor-settings.md` 或新增 `docs/visual-language.md` 记录编辑器胶片语言与可访问性约束；验证：文档中的 class/命令与实现一致，相对链接有效

## 8. 跨端视觉系统与回归

- [x] 8.1 抽取/对齐 Web 与编辑器共用的设计 token 命名（颜色、纸/胶片、强调、状态），避免两端同一语义不同命名；验证：`docs/visual-language.md` 的 token 表与两份 CSS 实际值一致
- [x] 8.2 在 Web 与编辑器分别检查浅色/深色（编辑器为暗房单主题）的焦点、错误、冲突、待发布状态；验证：两套主题截图与状态清单完整，颜色不是唯一线索
- [x] 8.3 运行 Web 与编辑器的完整测试，确认视觉改造未改变导入、生成、保存、发布行为；验证：`pnpm check:web` 与 `pnpm check:editor` 全绿

## 9. 集成验收

- [x] 9.1 运行根级 `pnpm check`，确认 lint/format/typecheck/单测全绿；验证：`pnpm check` 退出码为 0
- [x] 9.2 构建 Web 与编辑器，确认相纸/胶片样式进入产物且无资源缺失；验证：`pnpm build:web` 与 `pnpm build:editor` 成功，`apps/web/dist` 与 Tauri bundle 存在
- [x] 9.3 用真实浏览器和 Tauri 开发窗口做一次人工视觉验收（月历、单日、回退、图库、导入、详情、设置），记录截图与已知偏差；验证：验收记录包含浅/深主题截图与无阻断问题结论

## 10. 反馈修正：等高行与照片贴合

- [x] 10.1 将月历改为固定等高行（桌面/移动端），覆盖有照片、无照片与补位格；验证：新增 E2E 在 2024-02、2026-11、375px 与 1440px 下断言所有行高度一致
- [x] 10.2 移除编辑器图库/详情照片的白色纸边与额外内边距，使暗房框与照片同尺寸；验证：图库/详情截图确认无白边，编辑器结构测试全绿
- [x] 10.3 更新视觉语言/验收记录，重新生成截图并运行完整检查；验证：`pnpm check:web`、`pnpm check:editor` 与视觉文档一致

## 11. 月历无照片留白

- [x] 11.1 移除月历无照片日期的空白相纸与占位符，照片加载失败时同样只保留日期章；验证：Vitest/E2E 覆盖无照片、照片 404 与有照片日期，月历所有行仍等高
- [x] 11.2 更新视觉语言/验收记录并重新生成月历截图；验证：截图无空白相纸，`pnpm check:web` 全绿

## Workflow follow-up

- Archive the change after visual review and all tracked tasks are complete.
- Run `openspec validate restyle-photo-paper-film --strict` before archiving.
