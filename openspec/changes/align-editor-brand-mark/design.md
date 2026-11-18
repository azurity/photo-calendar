# Design

## Context

展示端的品牌标记由 `apps/web/src/styles.css` 的 `.brand-mark` 完成：18×18、`border: 2px solid var(--accent)`、`border-radius: 50% 50% 50% 4px`、`transform: rotate(-12deg)`、`background: radial-gradient(circle at 35% 35%, var(--accent-soft), transparent 60%)`。展示端在奶油纸面上使用砖红 `--accent` 与 `--accent-soft`。

编辑器当前用 `.brand-dot`：28×18，背景为 `assets/film-mark.svg` 的胶片条图形；侧栏是 240px 宽的深色暗房，强调色为琥珀 `--accent: #d08a4a`、`--accent-soft: #e0a678`。品牌区 `.brand-block` 是 flex 布局，图标 28px + 11px gap 后接「照片日历 / 编辑器」文字。代码中没有任何测试或脚本引用 `.brand-dot` 或 `film-mark.svg`。

## Goals / Non-Goals

**Goals:**

- 编辑器左上角使用与展示端相同的品牌图形、尺寸和倾斜。
- 标记颜色继续由各端主题 token 驱动，在深色侧栏中清晰可辨。
- 移除已无用途的胶片条 SVG，避免留下第二套品牌资产。

**Non-Goals:**

- 不修改 Tauri 窗口图标、任务栏图标、安装包图标或网页端标志。
- 不调整品牌文字字号、侧栏宽度、导航、间距体系或暗房主题 token。
- 不追求与展示端完全相同的十六进制颜色；两端颜色由各自主题 token 决定。

## Decisions

### 1. 复制展示端图形规则，映射到编辑器强调色 token

- 将 `.brand-mark` 的六行核心几何规则原样用于编辑器：18×18、2px 描边、`50% 50% 50% 4px` 圆角、-12° 旋转、35% 35% 的径向高光。
- 编辑器里颜色仍写 `var(--accent)` / `var(--accent-soft)`，因此渲染为琥珀描边与暖高光，而不是展示端的砖红。这是「同一标志、不同材质」：暗房侧栏已经以琥珀为强调色，硬编码网页砖红会与整套编辑器主题冲突，且在近黑背景上对比更弱。
- 备选：复制展示端的 `#a94e2f` / `#d9a48d` 固定值。被否决：颜色脱离编辑器 token，深色侧栏中偏暗，且后续换主题需要改两处。
- 备选：把标志做成共享 SVG 资源。被否决：展示端是纯 CSS 标记，没有现成共享资源；为一个 18px 图形引入打包资源不值得。

### 2. 用 `.brand-mark` 替换 `.brand-dot`，并删除 `film-mark.svg`

- `main.ts` 中把 `h('span', { class: 'brand-dot', 'aria-hidden': 'true' })` 改为 `.brand-mark`；`styles.css` 删除 `.brand-dot` 规则，新增 `.brand-mark` 规则。
- 删除 `apps/editor/src/assets/film-mark.svg`。全仓搜索确认只有 `.brand-dot` 引用它；Tauri 图标在 `src-tauri/icons/`，不受影响。
- 备选：保留 `.brand-dot` 类名只改样式。被否决：类名继续暗示胶片点，且会留下无引用的品牌 SVG，后续容易误用。
- 备选：保留 SVG 作为备用。被否决：未使用的资产会让品牌来源不唯一。

### 3. 接受图标变窄带来的轻微文字位移

- 品牌图标从 28px 宽变为 18px，`.brand-block` 的 gap 不变，品牌文字会整体左移约 10px。这是匹配展示端尺寸的自然结果，不遮挡、不换行、不挤压导航；在编辑器实际最小窗口宽度 900px（`tauri.conf.json` 的 `minWidth`；CSS 下界为 720px）下仍有充足空间。
- 备选：为图标保留 28px 槽位以冻结文字位置。被否决：会引入与展示端不同的视觉间距，且让「同一 logo」的尺寸关系变复杂。
- 视觉验收同时覆盖 1200×820 与最小宽度，确认侧栏标题、导航和发布卡片都不受挤压。

### 4. 用 DOM 断言锁住标记归属，用截图验证视觉一致

- 在现有编辑器启动测试中增加断言：`.brand-block .brand-mark` 存在且 `aria-hidden="true"`，`.brand-dot` 不存在。CSS 几何无法在 jsdom 中可靠断言，因此视觉一致以 Tauri 1200×820 截图与展示端标志对比为准。
- 截图保存为 `artifacts/visual/editor-brand-mark.png`，并在 `docs/visual-language.md` 的编辑器章节补充「品牌标记与展示端同形，颜色随暗房强调色」。
- 不引入像素基线，避免字体/缩放差异导致 CI 脆弱。

## Risks / Trade-offs

- **颜色与展示端不完全相同** → 已在非目标中说明；两端都使用各自 `--accent` / `--accent-soft`，形状与尺寸一致。若需要像素级同色，只需把两个 token 改为固定值，不影响结构。
- **品牌文字左移约 10px** → 检查 1200×820 与 900px 实际最小宽度，确认不换行、不与导航重叠。
- **删除 `film-mark.svg` 影响其他引用** → 删除前全仓搜索；当前只有 `.brand-dot` 使用，Tauri 图标独立。
- **深色侧栏中标记过暗** → 使用琥珀描边与暖高光，截图确认在 `#0b0907` 背景上清晰可辨。
- **类名替换漏改样式或测试** → DOM 断言覆盖 `.brand-mark` 存在与 `.brand-dot` 不存在；`grep` 确认无残留引用。

## Migration Plan

1. 修改 `main.ts` 的标记 class，`styles.css` 用 `.brand-mark` 替换 `.brand-dot`。
2. 删除 `film-mark.svg`，全仓搜索确认无引用。
3. 增加 DOM 断言，运行编辑器测试与类型检查。
4. 启动 Tauri 编辑器，截取 1200×820 品牌区并与展示端对比；检查 900px 实际最小宽度（CSS 下界为 720px）。
5. 更新 `docs/visual-language.md`。
6. 回滚：恢复 `main.ts` / `styles.css` 的旧规则与 SVG 即可；无数据迁移。

## Open Questions

无。颜色随编辑器主题 token 的决定已记录；若评审要求与展示端完全同色，可在同一实现中调整 token 或固定值。
