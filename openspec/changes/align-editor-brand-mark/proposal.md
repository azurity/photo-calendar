# Proposal

## Why

展示端左上角的「照片日历」标志是一枚由 CSS 绘制的非对称圆角标记（描边、径向高光、-12° 倾斜），编辑器左上角却仍是 28×18 的胶片条 SVG。两个产品因此像两个品牌：同一本相册与暗房，入口标记却完全不同。把编辑器的页内品牌标记改成与展示端同一图形，是最小的品牌一致性修复。

## What Changes

- 编辑器侧栏左上角品牌图标改为与展示端相同的 `.brand-mark`：18×18、`border-radius: 50% 50% 50% 4px`、2px 描边、径向高光、-12° 倾斜。
- 颜色沿用编辑器现有的暗房强调色 token（`--accent` / `--accent-soft`），不把展示端的砖红色值硬编码进深色侧栏；图形、尺寸、比例与倾斜与展示端保持一致。
- 保留 `aria-hidden="true"`、品牌文字「照片日历 / 编辑器」、侧栏间距与分隔线；不改变其他布局。
- 删除不再被引用的 `apps/editor/src/assets/film-mark.svg`。
- 不修改 Tauri 应用窗口图标、安装包图标或展示端标志；仅调整编辑器页面左上角的页内标记。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `editor-film-interface`: 新增「品牌标志一致性」要求，明确编辑器页内品牌标记须复用展示端的图形、尺寸与倾斜，并以编辑器主题强调色着色。

## Impact

- 代码：`apps/editor/src/main.ts`（品牌标记的展示性 class）、`apps/editor/src/styles.css`（品牌标记样式）、删除 `apps/editor/src/assets/film-mark.svg`。
- 文档：在 `docs/visual-language.md` 补充编辑器品牌标记与展示端一致、颜色随主题的说明。
- 依赖：无。
- 外部系统：无。Tauri 窗口图标、安装包与发布流程均不变。
- 验收：编辑器 1200×820 截图与展示端标志对比，图形、尺寸、倾斜一致；侧栏文字与导航不位移；无 axe 或布局回归。
