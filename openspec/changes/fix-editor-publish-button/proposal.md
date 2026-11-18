# Proposal

## Why

`renderShell()` 仍然创建发布卡片并调用 `renderPublishBox()`，但 `sidebar.append(publish)` 在 `b4f3dbc` 中被注释掉，编辑器因此完全没有可见的发布入口：用户无法从界面发起发布，3 个发布相关测试也因找不到「发布」按钮失败。恢复侧栏底部这块原本设计好的发布卡片，是最小且不改变发布语义的修复。

## What Changes

- 在 `renderShell()` 中把 `.publish-box` 重新挂到侧栏，并去掉对已不存在的 `createFilmEdge()` 的注释引用；发布卡片仍由现有 `renderPublishBox()` 渲染。
- 发布卡片继续显示现有状态：已配置仓库时展示「发布到 GitHub」、未发布提示、提交信息与「发布」按钮；未配置仓库时展示「尚未配置站点仓库」与「去设置」入口。
- 补充回归测试：断言发布卡片确实位于 `.sidebar` 内且包含「发布」按钮，防止再次出现「按钮存在但未挂载」；覆盖未配置仓库时「去设置」跳转设置页。
- 不修改发布命令、串行化、状态刷新、错误提示或样式；不新增依赖。
- 本次不修复另外两个既有失败：图库 `.film-edge` 缺少 `aria-hidden`、图库卡片文案摘要被注释。它们与发布按钮无关，另行处理。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-publishing`: 新增「发布入口」要求，明确编辑器必须在侧栏提供发布卡片与发布按钮，并在未配置仓库时提供设置入口。

## Impact

- 代码：`apps/editor/src/main.ts`（恢复侧栏挂载）、`apps/editor/src/app.test.ts`（发布入口回归断言）。
- 依赖：无。
- 外部系统：无。Git 命令、Tauri 命令接口、数据契约与发布流程不变。
- 验收：3 个既有发布测试恢复通过；新增发布入口与未配置状态测试通过。编辑器完整测试套件仍会因上述两个既有失败而失败，`pnpm check` 不会因此变绿，这是本变更的明确非目标。
