# Tasks

## 1. 品牌标记实现

- [x] 1.1 在 `apps/editor/src/main.ts` 把品牌图标 class 从 `brand-dot` 改为 `brand-mark`；在 `apps/editor/src/styles.css` 用展示端同款几何规则（18×18、2px 描边、非对称圆角、径向高光、-12° 倾斜）替换 `.brand-dot`，颜色使用 `--accent` / `--accent-soft`；验证 `grep -R "brand-dot" apps/editor/src` 无结果
- [x] 1.2 删除 `apps/editor/src/assets/film-mark.svg`，全仓搜索确认无引用；验证 `pnpm --filter @photo-calendar/editor typecheck` 通过且构建资源中不再包含该 SVG

## 2. 回归测试与文档

- [x] 2.1 在现有编辑器启动测试中增加断言：`.brand-block .brand-mark` 存在、带 `aria-hidden="true"`，且 `.brand-dot` 不存在；验证 `pnpm --filter @photo-calendar/editor exec vitest run src/app.test.ts -t "boots and navigates"` 通过
- [x] 2.2 更新 `docs/visual-language.md` 的编辑器章节，记录品牌标记复用展示端图形、尺寸与倾斜，颜色随暗房强调色；验证文档描述与最终 CSS/class 一致
- [x] 2.3 运行 `pnpm --filter @photo-calendar/editor typecheck` 与 `pnpm --filter @photo-calendar/editor test`，确认类型检查通过、品牌标记断言通过，且失败仍只有 `.film-edge` 与图库文案摘要两个既有项

## 3. 视觉验收

- [x] 3.1 启动 Tauri 编辑器，在 1200×820 截取左上角品牌区，保存为 `artifacts/visual/editor-brand-mark.png`，与展示端 `artifacts/visual/day-photo-light.png` 的品牌标志对比图形、尺寸与倾斜
- [x] 3.2 检查编辑器实际最小窗口宽度 900px（`tauri.conf.json` 的 `minWidth`；CSS 下界为 720px）下侧栏品牌文字不换行、不与导航重叠，标记不溢出或遮挡文字；记录实际检查方式与结果
- [x] 3.3 确认品牌区下方导航与发布卡片位置未因图标变窄而错位或被裁切；在 1200×820 截图中检查侧栏底部仍完整可见

## Workflow follow-up

- 评审通过后归档该变更，并把「品牌标志一致性」要求同步进 `editor-film-interface` 主规格。
- `.film-edge` 的 `aria-hidden` 与图库卡片文案摘要仍由另一个变更处理；本变更不将其纳入验收。
