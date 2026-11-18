# Design

## Context

`renderShell()` 在 `apps/editor/src/main.ts` 中创建 `publish` 容器并调用 `renderPublishBox()`，但挂载语句被注释为：

```ts
// sidebar.append(publish, createFilmEdge('vertical', 'sidebar-film-edge'));
```

`createFilmEdge()` 在当前代码中已不存在，因此不能原样取消注释；结果是发布卡片从未进入 DOM。`renderPublishBox()` 本身完整：已配置仓库时输出“发布到 GitHub”、状态、提交信息、发布按钮、线上站点/Actions 链接；未配置时输出“尚未配置站点仓库”与“去设置”。

`styles.css` 的 `.publish-box` 仍是侧栏底部布局（`margin-top: auto`、顶部分隔线），`.sidebar` 是纵向 flex 容器，品牌与导航之后追加发布卡片即可落到侧栏底部。现有 3 个发布测试都假设按钮存在；其中“publishes from the sidebar”只在名称上表达了位置，没有断言 DOM 归属，因此没有捕获这次回归。

## Goals / Non-Goals

**Goals:**

- 让发布卡片重新出现在侧栏底部，用户可从任意视图发起发布。
- 用回归测试锁住“发布卡片必须在 `.sidebar` 内”这一事实，而不仅是“页面上有发布按钮”。
- 覆盖未配置仓库时“去设置”的入口与跳转。

**Non-Goals:**

- 不修改发布命令、串行化、状态刷新、错误处理或发布卡片样式。
- 不修复图库 `.film-edge` 缺少 `aria-hidden`、图库卡片文案摘要被注释这两个既有失败；它们与发布入口无关，另行处理。
- 不追求编辑器完整测试套件或根级 `pnpm check` 变绿。

## Decisions

### 1. 只恢复 `sidebar.append(publish)`，不恢复 `createFilmEdge`

- `renderShell()` 中保留现有 `publish` 容器与 `renderPublishBox()`，改为 `sidebar.append(publish);`，并删除对该函数的注释引用。
- 侧栏底部是既有 CSS（`.publish-box { margin-top: auto }`）、既有测试命名（“publishes from the sidebar”）和全局可用性共同指向的位置；不需要新增布局。
- 备选：把发布卡片放进图库主区。被否决：发布是全局动作，放进图库会在导入/设置视图消失，且现有 CSS 与测试都按侧栏设计。
- 备选：在顶部栏新增一个发布按钮。被否决：与既有发布卡片重复，且改动面更大。

### 2. 不改样式，先验证侧栏高度与可见性

- 不新增 CSS；`.publish-box` 的间距、分隔线和 `margin-top: auto` 已足够。侧栏内容（品牌、3 个导航项、发布卡片）在最小窗口高度下应完整可见；若实现时发现 `.film-canister { overflow: hidden }` 裁切发布卡片，再单独评估是否改为可滚动，不预先扩大改动。
- 备选：给侧栏加 `overflow-y: auto`。被否决：当前没有证据表明会溢出，避免为未发生的问题改变布局。

### 3. 回归测试同时锁定位置与状态

- 在 `publishes from the sidebar and reflects the result` 中增加：
  - `.sidebar .publish-box` 存在；
  - 其中包含“发布到 GitHub”和「发布」按钮；
  - 点击后调用 `gitPublish`。
- 新增未配置场景：`settings.git.remoteUrl` 置空后，`.publish-box` 显示“尚未配置站点仓库”，其「去设置」按钮切换到设置视图且不调用 `gitPublish`。测试选择器必须限定在 `.publish-box` 内，因为设置横幅也可能出现「去设置」。
- 现有“快速点击串行化”和“发布失败刷新状态”测试保持不动，它们会自然覆盖按钮在 DOM 中的状态与禁用逻辑。
- 备选：只依赖现有 3 个测试。被否决：正是它们只查按钮文本、不查归属，才漏掉了这次回归。

### 4. 验证按本变更范围执行，不掩盖已知失败

- 定向运行发布相关测试与新增的未配置测试，并运行编辑器类型检查、lint、格式检查。
- 完整编辑器测试套件仍会因两个既有失败（`.film-edge` 的 `aria-hidden`、图库文案摘要）而失败；归档记录与最终报告必须明确这一点，不能声称 `pnpm check` 通过。

## Risks / Trade-offs

- **发布卡片在矮窗口下被侧栏裁切** → 先按现状实施并检查最小窗口；若裁切再单独处理侧栏滚动，不在本次预改。
- **未配置测试的选择器误点到设置横幅** → 所有断言限定在 `.publish-box` 内。
- **回归测试只断言文本、仍漏掉归属** → 必须断言 `.sidebar .publish-box`，而不是全局 `button('发布')`。
- **误把两个既有失败算进本次验收** → proposal、design、tasks 与最终报告都明确写出非目标，验证只针对发布入口。
- **未来再次出现“代码创建但未挂载”** → 位置断言把 DOM 归属作为回归条件；新增视图时也不会静默丢失发布入口。

## Migration Plan

1. 恢复 `sidebar.append(publish)`，删除 `createFilmEdge` 注释引用。
2. 补位置断言与未配置场景测试。
3. 运行定向发布测试、类型检查、lint 与格式检查；确认 3 个既有发布测试与新增测试通过。
4. 检查编辑器窗口下侧栏底部发布卡片的可见性；若正常即可结束。
5. 回滚：只涉及 `main.ts` 与 `app.test.ts`，按文件 revert 即回到无发布入口的状态；无数据迁移。

## Open Questions

无。
