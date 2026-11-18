# Design

## Context

见 `proposal.md`。当前单日页由 `apps/web/src/day.ts` 生成：`.day-view` 是两行网格，第一行 `.day-photo-stage` 内放 `figure.photo-paper`（`img.day-photo` 加一条装饰性 `.photo-paper-mark`），第二行是 `.day-copy.paper-copy` 纸卡，承载眉标、日期、星期和文案；导航由第三行自动排布。`styles.css` 中相纸用 `width: fit-content`、底部 42px 白边和 `--frame` 暖白纸色，照片 `object-fit: contain` 不裁切；深浅主题共用 token，相纸在深色下仍是浅色。

约束：

- 文案是 1–120 个纯文本字符，可能换行 1–3 行，不能裁切。
- 单日页在 320–1920px 无横向滚动；照片仍是视觉主体。
- 现有测试依赖 `.day-caption`、`.day-photo`、`h1#day-heading`、导航与 `aria-labelledby`；不能破坏。
- 项目坚持原生 DOM 与最小运行时依赖，外部资源沿用固定版本 CDN 的做法（现有 `css-doodle`）。
- 无照片日期的 `.fallback-view` / `.postcard-paper` 不在本次范围内。

## Goals / Non-Goals

**Goals:**

- 让有照片的单日页变成「一张写有字的相纸」：日期、星期和文案都在加高的底部白边内，白边随文案长度自然增高。
- 用手写字体与克制的墨迹处理，让文案像用马克笔写在相纸上，同时保持正文可读、可选、可被读屏访问。
- 在字体 CDN 失败、字符缺字、窄屏和深色主题下都有明确降级，不引入横向滚动或照片裁切。

**Non-Goals:**

- 不引入手动主题切换、编辑器改动、数据契约或文案生成逻辑改动。
- 不把无照片日期的明信片寄语改成手写风格。
- 不引入图片纹理、Canvas 手写笔迹或动画库；马克笔效果只用字体、颜色、变换与 CSS/SVG 装饰。
- 不重做月历相纸或 `.photo-paper` 之外的视觉语言。

## Decisions

### 1. 用 `figcaption` 收纳日期与文案，移除独立文案纸卡

- `renderPhotoDay` 中的结构改为：`figure.photo-paper` 内放 `img.day-photo` 与 `figcaption.photo-paper-note`；`figcaption` 依次放 `.day-eyebrow`、`h1.day-date#day-heading`（含 `time`）、`.day-weekday`、`p.day-caption#caption`。`h1` 仍留在文档中，`article[aria-labelledby="day-heading"]` 的无障碍名称不变。
- 移除 `.day-copy` 纸卡与装饰性 `.photo-paper-mark`：日期已经在白边内，重复的「日期 · 照片日历」印记只会稀释层级。`delete` 只影响照片日；`.fallback-copy` 保持原样。
- 保留 `.day-caption`、`.day-date`、`.day-weekday`、`.day-eyebrow` 的 class 与 `#caption`，单元测试与 E2E 只需调整「在相纸内」的断言，不需要重写选择器。
- 备选：保留日期纸卡、只把文案放进白边。被否决：用户明确选择「日期也并入相纸」，两处日期会让页面重新变成两张卡。
- 备选：用绝对定位把文案压在白边里。被否决：文案长度动态变化，绝对定位会裁切或覆盖照片。

### 2. 相纸宽度随照片收缩，白边由内容撑高

- `.photo-paper` 使用 `width: fit-content`，并给 `.photo-paper-note` 加 `contain: inline-size`，让文案不参与相纸的固有宽度计算：相纸宽度由照片决定，文案在照片宽度内换行，避免竖构图照片被过宽的相纸包住、两侧出现大片空白。
- 相纸设 `min-width: min(100%, 420px)` 与 `max-width: min(100%, 920px)`：窄照片也留出可读的文案行宽，全景照片不无限变宽；窄屏仍按可用宽度展示。
- `figure` 的 padding 为四周 12–14px、底部 0；`.photo-paper-note` 自己负责底部内边距（约 18–22px），白边高度 = 日期行 + 文案行数 + 内边距，不需要固定 min-height。这样 1 行文案不会留下空洞，3 行文案也不会裁切。
- 照片保持 `width: auto; max-width: 100%; max-height: min(64vh, 820px); object-fit: contain`，不裁切、不拉伸。
- `.day-view` 从两行网格改为纵向 flex（notice / 舞台 / 导航），`.day-photo-stage` 去掉 `overflow: hidden`，让白边变高时舞台随内容增长而不是裁切相纸；横向溢出仍由 `body { overflow-x: hidden }` 兜底，旋转角保持 -0.25°。
- 移动端把照片高度压到 `min(44vh, 420px)`，文案字号略降，保证 375px 下照片仍然是主体、白边文字完整可读。
- 备选：整张相纸固定 820px 宽。初版实施后截图发现竖构图照片两侧留白过大，像把照片贴在大卡纸上，不符合「只把下方白边留大」的直觉；因此改为随照片收缩。
- 备选：保留 `fit-content` 但不做 inline-size 包含。被否决：文案 max-content 会把相纸撑到上限，照片仍被挤在宽纸中央。

### 3. 手写字体从 CDN 分片加载，加载成功后再激活

- 在 `day.html` 增加 `preconnect` 与 `cn-fontsource-hongleixingshu-regular@1.0.7/font.css` 的样式表链接（`#handwriting-font`）。该 CSS 把洪蕾行书切成 72 个带 `unicode-range` 的 `@font-face` 分片，浏览器只下载文案实际用到的子集；固定版本避免上游变更。字体为作者免费商用、非开源授权，通过 CDN 引用而不在仓库内重新分发。
- 先用系统楷体/衬线回退渲染：`.day-caption` 默认使用 `'Kaiti SC', 'STKaiti', 'KaiTi', 'Xingkai SC', var(--font-serif)`；`day.ts` 等待字体样式表与 `document.fonts.load()` 成功后再给 `figcaption` 加 `.handwriting-ready`，切换到 `'hongleixingshu'`。这样字体慢或失败时文案始终立即可读，不会出现 `font-display: auto` 的 3 秒空白。
- 只用 regular 字重，不做伪粗体；字号与行高单独调到手写可读的档位（桌面约 1.12–1.44rem，移动端约 1.04–1.24rem）。
- 只在 `day.html` 引入，不在月历页引入；无照片日期不生成 `.day-caption`，不会触发字体下载。
- 备选：霞鹜文楷（SIL OFL、`font-display: swap`）。初版实施后截图发现它在文案字号下更像人文无衬线体，手写感不足，因此换用行书。备选：LXGW Marker Gothic（OFL，马克笔风格但偏漫画无衬线）。被否决：字形不够像真实手写。备选：自托管完整 TTF。被否决：体积过大且无法按字分片。

### 4. 马克笔质感用「字体 + 墨色 + 极轻变换 + 手绘线」，不叠滤镜

- 新增 token：`--marker-ink`（蓝黑墨色）、`--marker-bleed`（渗墨阴影）、`--marker-line`（手绘下划线）。相纸在深色主题下仍是浅色 `--frame`，因此墨色 token 不随主题反转，避免深色页面里出现「浅墨写在白纸上」。
- `.day-caption` 使用手写字体栈、`font-size: clamp(1.08rem, 2vw, 1.4rem)`、`line-height: 1.8`、`letter-spacing: 0.02em`、`text-wrap: pretty`；加 `transform: rotate(-0.4deg)` 与 `transform-origin: left top`，并在容器上留出内边距，避免旋转后边角被裁切。
- 墨迹只加一层极轻的 `text-shadow`（约 0.4px 偏移、低透明度）模拟渗墨；不使用 `filter: blur()` 或图片纹理，避免文字发虚、对比度下降与高清屏模糊。
- 唯一的额外装饰是文案块末尾一段低透明度的手绘下划线（内联 SVG data URI 或渐变笔触，`pointer-events: none`），不覆盖文字；`forced-colors` 下隐藏。日期与星期仍用印刷字体，形成「印刷日期 + 手写一句话」的层级。
- 备选：给每行文案做随机旋转。被否决：纯 CSS 无法逐行控制，JS 拆行会破坏文本选择与读屏。备选：整段加高亮块。被否决：会压缩正文对比度，且比「写上去」更像荧光笔标记。

### 5. 主题、对比度与动效

- 白边背景继续用 `--frame`，日期用 `--frame-ink`，眉标/星期用 `--frame-muted`；文案用 `--marker-ink`。浅色与深色都按「暖白纸 + 深墨」计算，目标是对比度 ≥ 7:1，至少满足 AA 的 4.5:1。
- 旋转、阴影和下划线都是静态装饰，不新增动画；`prefers-reduced-motion` 不需要额外规则，字体切换本身不触发过渡。
- 焦点样式不变；相纸不是交互控件，日期/导航链接仍是唯一焦点目标。
- 备选：深色主题下把相纸也调暗。被否决：会破坏「实体相纸」的隐喻，且现有规范要求深色下相纸仍为浅色。

### 6. 字体失败与布局稳定性

- 洪蕾行书的 `font.css` 没有声明 `font-display`（默认 auto，最多约 3 秒不可见），因此不直接把字体族写到文案上，而是先以回退字体渲染，`document.fonts.load()` 成功后再加 `.handwriting-ready`。CDN 失败、字体文件 404 或缺字时，类不会被加上，文案保持回退字体与布局，不会隐藏或消失。
- 允许激活后一次换行变化；相纸宽度由照片决定、`line-height` 固定，文案位于照片下方，不影响首屏 LCP 图片位置。
- 不预加载具体分片：分片由 `unicode-range` 决定，无法静态得知需要哪几片；`preconnect` 已经能减少连接开销。
- 备选：直接把字体族写进 `.day-caption`。被否决：默认 `font-display: auto` 会让慢网下的文案空白数秒。
- 备选：把字体 CSS 挂到 `styles.css` 全局引入。被否决：月历页完全不需要，且会让所有页面承担第三方 CSS 的加载。

### 7. 测试与文档

- 单元测试（`apps/web/src/day.test.ts`）：断言 `.day-caption` 位于 `figure.photo-paper` 内的 `figcaption`，`h1#day-heading` 仍在 `article` 内，照片日不再生成 `.day-copy`；回退日结构保持不变。
- E2E（`apps/web/tests/e2e/calendar.spec.ts`）：照片日文案可见且位于相纸内、`figcaption` 同时包含日期与星期；375px 与 1440px 无横向滚动；用 120 字文案的路由夹具检查白边增高后不裁切文字、不裁切照片；阻断 `cdn.jsdelivr.net` 后文案仍可见可读、`.handwriting-ready` 未激活。
- 可访问性（`a11y.spec.ts`）：浅色/深色照片日继续跑 axe；`theme.spec.ts` 的 token 断言不变。
- 视觉验收：浅色/深色、桌面/375px/320px 截图检查洪蕾行书激活后的字迹、白边比例与照片主体；不引入像素基线，也不把外网字体成功写进 CI 断言。
- 文档：更新 `docs/visual-language.md` 的单日结构与 token 表、`docs/visual-acceptance.md` 的验收条目；README 的目录说明不需要改。

## Risks / Trade-offs

- **字体激活造成一次换行跳动** → 先用回退字体渲染，字体就绪后只切换一次；相纸宽度由照片决定、行高固定，文案在照片下方，不移动首屏图片。
- **第三方 CDN 不可用或版本被移除** → 固定 `@1.0.7`，字体栈回退到系统楷体/衬线；E2E 阻断 CDN 验证文案仍可读、手写类未激活。
- **洪蕾行书为非开源、免费商用授权** → 只在页面中引用 CDN 的 `font.css` 与分片，不在仓库内重新分发字体文件；若授权或可用性变化，回退栈仍保证页面完整可用，并可换回 OFL 字体。
- **120 字文案在 320px 下白边过高** → 页面允许纵向滚动，白边随内容增长；测试确认不裁切、无横向滚动，照片仍有 44vh 上限。
- **手写字体对比度不足** → 墨色独立 token，按 ≥ 7:1 选择；深浅主题分别跑 axe 与截图。
- **旋转的文案块溢出相纸** → 文案块留内边距、旋转角 ≤ 0.5°，`overflow` 不裁切文字；窄屏把旋转收敛到 0。
- **极窄照片在 min-width 下留出少量侧边** → 420px 下限仅用于保证文案行宽，侧边仍小于照片宽度本身，不构成第二层相框。
- **移除 `.day-copy` 影响旧选择器/文档** → 全仓搜索并同步测试与视觉文档；`.fallback-copy` 完全不变。
- **字体 CSS 在无照片日期也加载** → 只加载 CSS 不加载字体文件；如后续成为性能问题，可改为照片日动态注入，不需要改规格。

## Migration Plan

1. 先改 `day.ts` 结构与单元测试，保持旧 CSS 也能渲染，确认照片日/回退日逻辑不回归。
2. 再改 `styles.css`：相纸宽度约束、白边、字体栈与墨迹 token；逐页检查 320/375/1440 与深浅主题。
3. 在 `day.html` 引入洪蕾行书 CSS，并实现「先回退、加载成功后激活」；验证字体加载成功与阻断 CDN 两种状态。
4. 更新 E2E、axe 与文档；跑 `pnpm check`、`pnpm test:e2e`、`pnpm test:a11y`。
5. 回滚：只涉及 `day.ts`、`styles.css`、`day.html` 与测试/文档，按文件 revert 即回到「相纸 + 独立纸卡」的旧版；无数据迁移、无发布链路变更。

## Open Questions

无。
