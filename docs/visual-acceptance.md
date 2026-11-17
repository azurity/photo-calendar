# 视觉验收记录

日期：2026-11-17（Asia/Shanghai）。本记录对应 `restyle-photo-paper-film` 的人工视觉检查。

## 截图

Web（1440×1000，Chrome）：

- `artifacts/visual/month-light.png`
- `artifacts/visual/month-dark.png`
- `artifacts/visual/day-photo-light.png`
- `artifacts/visual/day-photo-dark.png`
- `artifacts/visual/day-fallback-light.png`
- `artifacts/visual/day-fallback-dark.png`

编辑器（Tauri 开发窗口，1200×820，Linux）：

- `artifacts/visual/editor-gallery-root.png`：图库接触印样 + 侧栏 + 发布状态
- `artifacts/visual/editor-import-root.png`：导入胶片条/进片口
- `artifacts/visual/editor-detail-root.png`：详情底片框与文案区
- `artifacts/visual/editor-settings-root.png`：设置/密钥/仓库表单

## 结果

- 月历与单日页在浅色/深色下使用同一主题 token；深色不是反色，相纸框保持暖白。
- 相纸日期、单日主图、无照片明信片、窄屏 320px 触控区均已检查；Playwright 覆盖无横向滚动。月历所有日期行等高（桌面/移动端），无照片日期只留日期与空白纸面，不出现空白相纸；编辑器图库与详情无白边、展示框与照片贴合。
- 编辑器图库呈现接触印样与帧号；导入为胶片条/进片口；设置、详情、确认弹窗共享暗房记录卡语言。胶片孔由内联 SVG pattern 的 evenodd 挖空绘制，背景颗粒仅保留极弱底层点纹；不再使用重复线性渐变或 CSS mask。
- `pnpm check:web`（24 个 E2E）、`pnpm check:editor`（35 个测试）与 axe 检查通过。
- 已知限制：编辑器截图为桌面根窗口截图，右侧可见桌面上未关闭的 Chrome 窗口；它不是应用内容。Tauri 应用本身为 1200×820。
- 编辑器暗房主题为单一深色主题，不跟随系统浅色；这是本次设计的明确非目标。
