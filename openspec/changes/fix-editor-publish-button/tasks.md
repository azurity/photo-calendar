# Tasks

## 1. 恢复侧栏发布入口

- [x] 1.1 在 `apps/editor/src/main.ts` 的 `renderShell()` 中把注释行改为 `sidebar.append(publish);`，删除对已不存在的 `createFilmEdge()` 的引用；验证 `pnpm --filter @photo-calendar/editor typecheck` 通过
- [x] 1.2 在 jsdom 渲染或 Tauri 开发窗口中确认 `.sidebar .publish-box` 出现在侧栏底部、包含「发布到 GitHub」与「发布」按钮；若无法启动图形窗口，以 DOM 断言结果记录

## 2. 发布入口回归测试

- [x] 2.1 扩展 `publishes from the sidebar and reflects the result`：断言 `.sidebar .publish-box` 存在、包含「发布到 GitHub」与「发布」按钮，点击后调用 `gitPublish`；验证 `pnpm --filter @photo-calendar/editor exec vitest run src/app.test.ts -t "publishes from the sidebar"` 通过
- [x] 2.2 新增 `shows a setup entry instead of publish when git is not configured`：用空 `git.remoteUrl` 启动，断言 `.publish-box` 显示「尚未配置站点仓库」，其「去设置」按钮进入设置视图且不调用 `gitPublish`；验证该定向测试通过
- [x] 2.3 运行 `pnpm --filter @photo-calendar/editor exec vitest run src/app.test.ts -t "publish"`，验证串行化、侧栏发布、发布失败与未配置入口 4 个测试全部通过
- [x] 2.4 运行完整编辑器测试 `pnpm --filter @photo-calendar/editor test`，确认发布相关失败已消失，失败列表只剩 `.film-edge` 缺少 `aria-hidden` 与图库文案摘要两个既有问题，并记录实际通过/失败数量

## 3. 集成验证

- [x] 3.1 对改动文件运行 `pnpm exec eslint apps/editor/src/main.ts apps/editor/src/app.test.ts` 与 `pnpm exec prettier --check apps/editor/src/main.ts apps/editor/src/app.test.ts`，验证无 lint 或格式问题
- [x] 3.2 运行 `pnpm --filter @photo-calendar/editor typecheck` 与 `pnpm --filter @photo-calendar/editor test`，确认类型检查通过、发布测试通过，且未引入新的编辑器失败
- [x] 3.3 在 1200×820 编辑器窗口或等价视口检查侧栏底部：发布卡片完整可见、可点击，不被 `.film-canister` 的 `overflow: hidden` 裁切；若窗口高度受限则记录实际可见高度与处理结论
- [x] 3.4 运行根级 `pnpm check` 并记录结果：确认失败中不再包含 3 个发布测试；剩余两个既有失败按非目标处理，不声称全仓检查通过

## Workflow follow-up

- 评审通过后归档该变更，并把「发布入口」要求同步进 `git-publishing` 主规格。
- 另开变更修复 `.film-edge` 的 `aria-hidden` 与图库卡片文案摘要，使编辑器完整测试与根级 `pnpm check` 恢复全绿。
