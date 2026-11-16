# 视觉语言：相纸与暗房

展示端与编辑器共享「记录一天」的语义，但使用两种材质：网页像一本相纸/拍立得相册，编辑器像一间胶片暗房。本文记录 token、展示性结构与可访问性约束；实现以 `apps/web/src/styles.css` 与 `apps/editor/src/styles.css` 为准。

## 展示端：相纸 / 拍立得

### 主题

- 主题跟随系统 `prefers-color-scheme`，不提供手动开关。
- `:root` 声明 `color-scheme: light dark`；深色值只覆盖 token，不复制组件规则。
- `index.html` 与 `day.html` 各有 light/dark 两条 `meta[name="theme-color"]`。
- 月历与单日页消费同一组 token，因此不会出现一个页面浅色、一个页面固定深色。

### Token

| token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--paper` | `#f4eee3` | `#171310` | 页面/纸面底色 |
| `--paper-deep` | `#e7ddce` | `#211b16` | 补位、次级纸面 |
| `--paper-raised` | `#fffaf1` | `#261f19` | 浮起纸面/面板 |
| `--ink` | `#27241f` | `#f2e8da` | 正文 |
| `--muted` | `#6d655b` | `#b9a998` | 次要文字 |
| `--accent` | `#a94e2f` | `#d98a5f` | 强调/今天 |
| `--frame` | `#fffdf7` | `#efe6d6` | 相纸纸边 |
| `--frame-ink` | `#3a332b` | `#302920` | 相纸上的文字 |
| `--frame-muted` | `#7d7061` | `#7b6c5b` | 相纸上的日期/印章 |
| `--tape` | 暖半透明 | 暗琥珀 | 胶带 |
| `--stage` | `#d7c8b4` | `#0f0c09` | 单日照片舞台 |
| `--copy-bg` | 暖白半透明 | 深棕半透明 | 文案纸卡 |

### 展示性结构

- 月历：有照片时 `.day-cell` 内是 `span.day-print`，包含 `.day-thumb` 与 `.day-cell-caption`；无照片日期不生成 `day-print`，只保留日期章和空白纸面。照片加载失败也移除 `day-print`。所有日期行使用固定等高轨道（桌面 118px、移动端 64px）。
- 单日：`.photo-paper` 包住 `.day-photo`，`.day-copy.paper-copy` 是独立纸卡；无照片使用 `.postcard-paper`。
- 装饰（胶带、纸边、阴影、日期章）由 CSS 渐变/伪元素实现；不进入可访问树、`pointer-events: none`。
- 移动端取消相纸旋转；320px 起日期格仍保持至少 44×44。

### 可访问性

- 两套主题分别跑 axe；正文对比度按 WCAG AA。
- 今天、无照片、照片缺失等状态同时使用文字/边框/形状，不只依赖颜色。
- `prefers-reduced-motion: reduce` 下相纸悬停与主题过渡被关闭。

## 编辑器：胶片 / 暗房

### Token

编辑器是单一暗房主题，不跟随系统浅色。为与展示端保持语义一致，提供了 `--paper`、`--paper-deep`、`--paper-raised`、`--stage`、`--copy-bg`、`--copy-ink`、`--tape` 别名。

| token | 值 | 用途 |
| --- | --- | --- |
| `--bg` / `--paper` | `#14110e` | 暗房工作台 |
| `--panel` / `--paper-deep` | `#211b15` | 面板/记录卡 |
| `--panel-raised` | `#2a221a` | 浮起面板/toast |
| `--ink` / `--copy-ink` | `#f2e8da` | 正文 |
| `--muted` | `#b6a493` | 次要文字 |
| `--accent` | `#d08a4a` | 琥珀安全灯强调 |
| `--accent-strong` | `#e4a463` | 悬停/待发布 |
| `--safelight` | `#a8442d` | 暗房安全灯红 |
| `--film` / `--stage` | `#0d0b09` | 接触印样/底片台 |
| `--frame` | `#e8ddcc` | 相纸/印样纸边 |
| `--frame-ink` | `#2e261e` | 印样文字 |
| `--danger` | `#e47d66` | 错误 |
| `--success` | `#7fa889` | 成功 |

### 展示性结构

- `.app-shell.film-shell`、`.sidebar.film-canister`、`.editor-main.darkroom-desk`：暗房工作台与胶片罐侧栏。
- `.photo-grid.contact-sheet`：接触印样网格；`.photo-card` 是暗房印样，缩略图不留白边，`.photo-frame-number`（`aria-hidden`）显示 `FRAME 01` 等帧号。
- `.draft-list.film-strip`：导入胶片条；`.drop-zone.film-gate`：进片口。
- `.detail-image.negative-frame`：放大底片框，尺寸由图片本身决定、无白边；`.detail-form.lab-card`、`.settings-form.lab-card`、`.secret-box.lab-card`：暗房记录卡。
- `.confirm-dialog.lab-dialog`：暗房确认弹窗。

### 可访问性

- 胶片齿孔/纹理为伪元素或 `pointer-events: none`，不进入可访问树；帧号 `aria-hidden`，日期与文案仍是主信息。
- 正文/控件在深色背景上按 WCAG AA 检查；焦点使用 `--focus` 高对比外框。
- `prefers-reduced-motion: reduce` 下胶片过渡关闭或缩短。
- 最小窗口宽度 720px 的既有约束不变，装饰不造成横向滚动。
