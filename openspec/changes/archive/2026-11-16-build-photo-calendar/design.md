# Design

## Context

见 `proposal.md`。当前仓库除需求文档外为空，没有既有代码、构建链或发布流程需要兼容；因此本设计同时确定仓库骨架、两个应用的边界、两端共享的数据契约，以及第一版上线路径。

约束来自需求本身：展示端必须是可部署到 GitHub Pages 的纯静态页面，尽量不引入复杂前端框架；编辑端是 Tauri 跨平台桌面应用；一天最多一张照片；无照片日期的内容必须可复现；文案由 DeepSeek 视觉模型生成；发布只能通过 Git。

设计假设（若后续被否定，会改变任务拆分）：

- 站点仓库同时容纳展示源码、`data/` 数据与 GitHub Actions 工作流，编辑器推送到该仓库后由 Actions 重新构建并部署 Pages。
- 照片本体随仓库发布，不依赖图床或对象存储；发布前压缩，并以白名单重建元数据，仅保留拍摄时间、镜头与曝光参数。
- Git 认证交给用户已有的系统凭据管理器或 SSH Agent，应用不保存访问令牌。
- DeepSeek 使用其 OpenAI 兼容接口与当前支持图片输入的 `deepseek-flash` 模型。

## Goals / Non-Goals

**Goals:**

- 以最小依赖实现一套可直接静态托管、移动端可用的展示站，并把「确定性回退」做成可单测的纯函数。
- 让编辑器的照片处理、EXIF 日期映射、文案生成和 Git 发布形成一条可恢复的本地优先流水线。
- 用一份带版本号的数据契约连接两端，并让 Rust 写入端与 TypeScript 读取端对同一批 fixture 做一致性校验。
- 在 Windows 与 Linux 上可构建、可运行，且不依赖自建服务端。
- 让发布失败、API 失败、网络离线都不会丢失用户已经选好的照片和文案。

**Non-Goals:**

- 不实现多图/视频日程、账号体系、云同步、评论或社交功能。
- 不做照片精修、滤镜、裁剪或 RAW 显影。
- 首版不支持 HEIC/RAW；不把 HEIC 转码作为隐式依赖。
- 不做服务端渲染；社交平台的 Open Graph 元数据只能尽力而为（见风险）。
- 不实现自动合并或变基冲突解决；分叉时交给用户处理。
- 不为 macOS 提供验收与 CI 矩阵（代码可保持可移植，但不承诺）。
- 不引入 Git LFS；首版用压缩后的 WebP 控制仓库体积。

## Decisions

### 1. 仓库采用 pnpm monorepo，展示端与编辑端共享 TypeScript 契约

```text
photo-calendar/
├── apps/
│   ├── web/                    # Vite 多页静态站：index.html + day.html
│   └── editor/                 # Tauri 2 应用
│       ├── src/                # 原生 TypeScript 视图层
│       └── src-tauri/          # Rust 命令层
├── packages/
│   └── shared/                 # 日期、确定性算法、zod 数据契约、常量
├── data/
│   ├── calendar.json           # 发布数据
│   └── photos/                 # 主图与 thumbs/ 缩略图
├── .github/workflows/          # pages.yml、ci.yml、editor-build.yml
├── pnpm-workspace.yaml
└── package.json
```

理由：展示端和编辑端需要共用日期语义、确定性算法和数据结构；pnpm workspace 能在不引入框架的前提下提供类型共享与统一脚本。`data/` 放在仓库根而不是某个应用的 `public/` 下，是为了让编辑器不依赖具体前端目录，也让 GitHub Pages 工作流把「内容」与「构建」分开。

替代方案：两个独立仓库。被否决，因为发布流程、数据契约与 CI 会重复，且编辑器需要额外知道展示仓库结构。

### 2. 展示端使用原生 TypeScript + Vite 多页构建，不使用前端框架

- `apps/web/index.html` 是月历页，`apps/web/day.html` 是单日页；两页共享 `src/` 下的数据加载、日期工具、回退逻辑与样式。
- Vite 负责模块打包与本地开发；不使用 React/Vue/Svelte。DOM 更新用小型 `render` 函数与原生事件，页面结构简单，无需虚拟 DOM。
- 样式使用原生 CSS（自定义属性、Grid、`clamp()`、`prefers-reduced-motion`），不引入 Tailwind 或组件库。
- 月历用查询参数 `?month=YYYY-MM`，单日页用 `?date=YYYY-MM-DD`；这是 GitHub Pages 上最稳妥的静态路由方式，无需服务端重写。
- 所有站内链接使用相对路径（`./day.html?...`），构建 `base` 使用相对基路径，保证项目页子路径可用。

替代方案：单页应用 + History API。被否决，因为 GitHub Pages 对任意深路径需要 `404.html` 兜底，复杂度和不可控性都更高；查询参数已经满足深链接需求。

### 3. 数据由构建期版本号 + 运行期读取共同处理，照片使用内容寻址文件名

- 展示页运行时 `fetch` 同源的 `data/calendar.json`，而不是把数据编译进 JS。这样编辑器只需提交数据，不需要改前端代码。
- Vite 插件在构建时读取 `data/calendar.json` 的 `updatedAt`，通过 `define` 注入 `__CALENDAR_VERSION__`；页面请求 `data/calendar.json?v=<updatedAt>` 以避免 GitHub Pages/CDN 返回旧数据。开发模式下插件同时把仓库根的 `data/` 映射到 `/data/`，并在构建结束把 `data/` 复制到 `dist/data/`。
- 照片文件名包含原图内容哈希（如 `2026-11-08-a1b2c3d4.webp`），替换照片必然产生新 URL，解决静态资源的强缓存问题。
- 若 `data/calendar.json` 缺失或无效，展示页按「全部日期无照片」降级；单张照片 404 时该日单独降级，不影响其他日期。

替代方案：把数据作为模块 import 到构建产物。被否决，因为这样每次内容更新都要重新构建，且无法满足「数据文件是两端契约」的要求；同时会把数据版本与前端代码版本耦合。

### 4. 无照片内容用 FNV-1a 哈希做纯函数选择，css-doodle 使用固定 seed

回退逻辑放在 `apps/web/src/fallback/`，核心是纯函数：

```ts
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const phrase = PHRASES[hash32(`${date}|phrase|v1`) % PHRASES.length];
const pattern = PATTERNS[hash32(`${date}|pattern|v1`) % PATTERNS.length];
const seed = hash32(`${date}|seed|v1`) || 1;
```

- 只依赖日期字符串与固定库内容，不读取当前时间、不调用 `Math.random`；对回退模块加 ESLint 限制，禁止 `Math.random`。
- 语句库与图样库各带一个内容版本常量；同一部署版本内保证稳定。库内容变更属于产品变更，允许同一天内容随之改变，但必须在发布说明中说明。
- 每个图样是一段合法的 css-doodle 规则文本；渲染时设置 `<css-doodle seed="{seed}">` 并写入规则。图样不得包含动画，避免「减少动态效果」偏好下的额外处理。
- `css-doodle` 通过 `https://unpkg.com/css-doodle@0.38.4/css-doodle.min.js` 固定版本加载；脚本加载失败或自定义元素未升级时，给容器加 `fallback-pattern` 类，显示纯 CSS 渐变/纹理。即使 CDN 完全不可用，寄语、日期与导航仍可读。

替代方案：用 `Math.random` + 日期缓存。被否决，因为跨设备/首次加载的缓存状态不可控，无法保证同一天一致。替代方案：用日期直接取模。被否决，因为相邻日期的图样会呈机械轮换；哈希能保留稳定性的同时让分布更自然。

### 5. 发布数据契约版本 1：数组条目、明确路径、严格校验

`data/calendar.json` 的规范形态：

```json
{
  "version": 1,
  "updatedAt": "2026-11-15T10:00:00Z",
  "entries": [
    {
      "date": "2026-11-08",
      "photo": "data/photos/2026-11-08-a1b2c3d4.webp",
      "thumbnail": "data/photos/thumbs/2026-11-08-a1b2c3d4.webp",
      "caption": "风把下午吹得很慢，连影子都愿意多留一会儿。",
      "captionSource": "generated",
      "captionModel": "deepseek-flash",
      "captionPromptVersion": 1,
      "captionUpdatedAt": "2026-11-15T09:55:00Z",
      "capturedAt": "2026-11-08T17:30:00+08:00",
      "createdAt": "2026-11-15T09:50:00Z",
      "updatedAt": "2026-11-15T09:55:00Z"
    }
  ]
}
```

- `entries` 用数组而不是以日期为键的对象：JSON 对象无法可靠表达重复键，而单日唯一性必须在解析阶段可检测。
- `photo`/`thumbnail` 使用仓库根相对 POSIX 路径；展示端用 `new URL(path, document.baseURI)` 解析，编辑端用规范化后的工作副本根解析并拒绝绝对路径、`..` 与符号链接逃逸。
- 镜头与曝光信息不写入 `calendar.json`；它们只以白名单 EXIF 的形式保留在发布主图中，避免数据文件膨胀与双份来源。缩略图不写 EXIF。
- `capturedAt` 仅在 EXIF 提供时区偏移时写入；没有偏移时不伪造偏移，日期已足够表达当天。日期与 `capturedAt` 的当地日期必须一致。
- `updatedAt` 单调递增：取 `max(now, previous + 1s)`，确保同一秒内多次保存也能让缓存键变化。
- 写入顺序：先写临时文件并 `fsync`，再原子替换 `calendar.json`；照片先落临时文件再重命名。任何失败保持旧版本。
- TypeScript 端用 `zod` 做运行期校验；Rust 端用 `serde` + 显式校验函数。两端共享 `packages/shared/fixtures/` 下的合法/非法样本，避免契约漂移。
- 未知字段读取时忽略；编辑器保存条目时以当前字段集重写（不承诺保留未知字段），版本升级由迁移函数处理。

### 6. 展示端布局与可访问性策略

- 月历：CSS Grid 七列，周一为首日；日期格包含日号与缩略图（有照片时），无照片日期只显示日号。今天用边框/色块标记，选中日用另一种标记。移动端日期格保持可点击，最小触控区 44×44。
- 单日页：有照片时用 `object-fit: contain` 的沉浸式主图 + 下层信息区，移动端纵向堆叠；无照片时用居中寄语 + 固定定位的 css-doodle 背景，背景加遮罩以保证对比度。
- 文案只用 `textContent` 写入；照片 `alt` 包含日期与文案摘要（截断）。标题用 `<h1>`，日期用 `<time datetime="...">`。
- 动态更新 `document.title`、`meta[name=description]`、`og:title`、`og:description`、`og:image`。由于没有服务端渲染，爬虫可能只能看到默认元数据；这是明确接受的限制。
- 页面加载状态用骨架/文本提示；数据错误用不阻塞的提示条，不弹窗打断浏览。
- 加载 `css-doodle` 的 `<script>` 使用 `defer`，并在加载后检测 `customElements.get('css-doodle')`；2 秒未升级则启用 CSS 降级。

### 7. 编辑器采用 Tauri 2 + Rust 命令层，前端保持原生 TypeScript

Rust 后端承担所有需要权限、文件系统、密钥、网络和 Git 的工作；WebView 只负责界面与调用命令。

主要命令（命名以实现为准）：

| 命令 | 职责 |
| --- | --- |
| `settings_get` / `settings_save` | 读取、校验、原子保存非敏感配置 |
| `secret_set` / `secret_clear` / `secret_status` | 操作系统钥匙串中的 DeepSeek Key |
| `settings_test_deepseek` / `settings_test_git` | 带超时的连接测试 |
| `photos_preview_import` | 解析 EXIF、校验格式/尺寸、生成临时预览、返回日期与冲突 |
| `entries_list` / `entry_get` | 读取数据并返回条目 |
| `caption_generate` | 调用 DeepSeek，返回候选文案；含刷新去重 |
| `entry_save` | 处理图片、原子写数据、按需自动发布 |
| `entry_delete` / `caption_save` | 删除条目/保存手动文案 |
| `repo_validate` / `git_publish` / `git_status` | 仓库兼容性、发布与状态 |

- 命令参数与返回值都用 `serde` 结构体，TS 端共享对应类型；前端不直接读任意路径，文件选择由 `tauri-plugin-dialog` 完成，Rust 再校验路径。
- 图片解码、缩放、WebP 编码是 CPU 密集操作，放在 `tokio::task::spawn_blocking`；Git 操作是阻塞进程调用，放在专用 blocking 任务。全局发布锁用 `tokio::sync::Mutex`，同一时刻只允许一个发布。
- 前端不用 React/Vue；用 `createStore` + 视图模块 + 原生 DOM 渲染。设置、导入、图库、详情是四个顶层视图，模态框负责覆盖确认与删除确认。
- 事件通过 Tauri `emit` 发送导入/发布进度（例如 `import:progress`、`publish:progress`），前端订阅更新状态。

替代方案：所有逻辑放在前端，使用 Tauri HTTP/FS 插件。被否决：API Key 会进入 WebView 内存与日志，Git 与钥匙串能力也更适合放在 Rust；同时可避免给 WebView 开放宽泛的文件系统权限。

### 8. 照片处理管线：EXIF 日期 -> 方向校正 -> 双尺寸 WebP -> 元数据白名单 -> 原子落盘

1. **入口校验**：只接受 JPEG/PNG/WebP；单文件 ≤ 50 MiB，解码前像素上限 100 MP；用 `image` crate 的 `Limits` 防解压炸弹。
2. **EXIF 解析**：`kamadak-exif` 读取 `DateTimeOriginal`（36867），回退 `DateTimeDigitized`（36868）、`DateTime`（306）；偏移读取 `OffsetTimeOriginal`（36881）、`OffsetTimeDigitized`（36882）、`OffsetTime`（36880）。时间格式为 `%Y:%m:%d %H:%M:%S`，偏移为 `±HH:MM`。同时读取 8.1 的镜头与曝光白名单标签；白名单以外的 EXIF 不进入输出。
3. **日期语义**：有偏移时用 `chrono::FixedOffset` 得到拍摄地当地日期；无偏移时直接取 `NaiveDateTime` 的日期。两种情况都不做 UTC 平移。全部时间缺失时返回 `date = null`，前端强制用户选择日期。
4. **方向与颜色**：读取 EXIF Orientation，用 `DynamicImage::apply_orientation` 做 8 种朝向校正；校正后不保留 `Orientation` 标签。不做色彩管理转换（首版只保证 sRGB 观感）。
5. **输出**：长边 ≤ 2400 的主图 WebP（质量约 82）与长边 ≤ 640 的缩略图 WebP（质量约 78），不放大。用 `webp` crate（libwebp）做有损编码；`image` 负责解码与缩放。
6. **命名**：计算原图字节的 SHA-256 前 8 位十六进制，文件名 `YYYY-MM-DD-<hash8>.webp`，缩略图同基名放在 `photos/thumbs/`。同一原图重复导入得到相同文件名，不同内容不会冲突。
7. **元数据**：重新编码先丢弃原图全部 EXIF/XMP/IPTC/ICC/注释，再按 8.1 的白名单重建一个最小 EXIF 块写入主图；缩略图不写 EXIF。GPS、机身/镜头序列号、所有者、软件、备注、`MakerNote`、内嵌缩略图等一律不进入输出。条目中不保存原始绝对路径。
8. **原子性**：照片先写 `.tmp` 再重命名；全部成功后才替换 `calendar.json`。替换旧条目的旧资源在新数据落盘后删除；删除失败只记录，不阻塞保存。
9. **清理**：启动时扫描 `data/photos/` 中符合本应用命名模式的孤立文件，提供清理或自动清理日志；不删除不符合命名模式的用户文件。

#### 8.1 EXIF 元数据白名单

主图只允许出现以下三类标签，其他标签一律不写入：

| 类别 | 允许的 EXIF 标签 |
| --- | --- |
| 拍摄时间 | `DateTime`、`DateTimeOriginal`、`DateTimeDigitized`、`OffsetTime`、`OffsetTimeOriginal`、`OffsetTimeDigitized`、`SubSecTime`、`SubSecTimeOriginal`、`SubSecTimeDigitized` |
| 镜头信息 | `LensMake`、`LensModel`、`LensSpecification`、`FocalLength`、`FocalLengthIn35mmFilm` |
| 曝光参数 | `ExposureTime`、`FNumber`、`ISOSpeedRatings`/`PhotographicSensitivity`、`ExposureProgram`、`ExposureBiasValue`、`MeteringMode`、`Flash`、`ApertureValue`、`MaxApertureValue`、`ShutterSpeedValue`、`BrightnessValue`、`ExposureMode` |

- 显式移除：GPS 全部标签、`Make`/`Model`、`BodySerialNumber`/`LensSerialNumber`、`CameraOwnerName`、`Artist`/`Copyright`、`Software`、`ImageDescription`/`UserComment`、`MakerNote`、内嵌缩略图、`Orientation`、`ColorSpace`，以及 XMP/IPTC/ICC/注释等非 EXIF 元数据。镜头序列号视为设备标识，不因属于「镜头信息」而保留。
- 实现：用 `kamadak-exif` 读取白名单标签，构造全新的 `little_exif::Metadata`；不复制原始 EXIF 块。libwebp 有损编码通常输出 simple WebP，写入前将其转换为带 `VP8X` 的 extended WebP，再由 `little_exif` 写入 EXIF chunk。若某个白名单标签类型损坏，丢弃该标签并记录；若白名单写入失败，保存整体失败，不发布缺字段或含禁止标签的主图。
- 不存在可保留字段时，主图不写空 EXIF 块；缩略图始终不写 EXIF。
- 写入后用 `kamadak-exif` 读回，测试断言标签集合恰好等于白名单子集、禁止标签与禁止元数据均不存在，并校验镜头/曝光值。

替代方案：保留原图并只删除 GPS 标签。被否决：原图仍可能包含序列号、所有者、软件、备注与 `MakerNote` 等难以穷举的敏感字段；逐项删除不如解码后重建白名单可控。替代方案：只把镜头/曝光写进 `calendar.json` 而不写回图片。被否决：展示端不需要这些字段，写进清单会让数据文件膨胀且产生双份来源；EXIF 白名单更适合「随图片保留」的需求。替代方案：输出 JPEG。WebP 在同等质量下更小，且现代浏览器覆盖足够；若实现阶段 libwebp 跨平台构建出现问题，允许在同一契约下把扩展名改为 `.jpg` 并同步调整校验器（属于实现细节，不改变行为规格）。

### 9. EXIF 缺失、冲突与覆盖确认

- 导入先进入草稿状态：Rust 返回每张照片的临时预览、解析出的日期、是否冲突、冲突旧条目的摘要。草稿不写 `calendar.json`。
- 批内同一天的多张照片在预览阶段标红，用户必须选择保留一张或全部取消；与已有条目冲突时展示旧/新缩略图与日期，选择「覆盖」才在最终保存时替换。
- 最终保存一次性提交所有无冲突与已确认覆盖的条目；任何一项失败则整批不落盘（照片临时文件可清理）。
- 覆盖时先写新资源，再替换清单，最后删除旧资源；崩溃最多留下可识别的孤立文件，不会出现清单指向不存在图片。

### 10. DeepSeek 文案生成：Rust 侧请求、结构化提示、刷新去重

- 请求在 Rust 中构造：`POST {baseUrl}/chat/completions`，`Authorization: Bearer <key from keyring>`，模型默认 `deepseek-flash`。
- 消息结构使用 OpenAI 兼容的多模态格式：`content` 数组包含一个 `text` 块与一个 `image_url` 块，图片为 `data:image/jpeg;base64,...`，`detail` 使用 `high`（需要辨认画面细节；图片已被压到 1568 长边，token 上限约 1024）。
- 发送给模型的图片是临时生成的 1568 长边、质量 80、完全去元数据 JPEG（不包含发布主图保留的时间/镜头/曝光白名单），且 ≤ 2 MiB；不发送原始文件、本地路径、GPS 或设备信息。
- 系统提示词固定为「照片日历文案写作者」，并约束：中文；1–2 句；15–120 个汉字；必须包含至少一个从画面中可辨认的具体元素；感性与探索意味；有可靠日期特征时可自然呼应；引用必须准确，否则不用；不要通用祝福、不要 Markdown、不要解释、只输出文案。
- 用户提示包含：`YYYY-MM-DD`、星期、节日/节气特征（由前端 `lunar-javascript` 计算后传入）、是否是刷新、上一版文案（刷新时）。刷新时明确要求「必须与上一版不同」。
- 提示词版本常量 `caption-prompt-v1`；模型名、版本、生成时间写入条目元数据。
- 结果处理：去掉首尾空白、包裹引号与代码围栏；拒绝空、多段、含 Markdown 结构、超过 120 字的结果；长度与中文字符比例做基本校验。
- 去重：对文案做 `NFKC` 规范化，去掉空白与 Unicode 标点后比较；与上一版相同则重试，最多共 3 次；仍重复则返回「未生成新文案」并保留旧内容。历史更早版本不参与比较。
- 错误映射：未配置 Key、400（模型/参数）、401/403、402（余额）、429（频率，读取 `Retry-After`）、5xx、超时、内容安全拒绝。所有错误保留旧文案，UI 给出可操作提示；不对 429 做无上限自动重试。
- 连接测试：优先 `GET /models`；若服务端不提供，则用 `max_tokens: 1` 的最小 chat 请求。测试结果只返回状态与模型名，不返回密钥。

替代方案：前端直接请求 DeepSeek。被否决：CORS 不可控，密钥会进入 WebView 与浏览器日志，且无法统一做图片压缩与错误脱敏。

### 11. 日期特征由编辑器前端计算，Rust 只负责拼装提示

- `apps/editor/src/date-facts.ts` 包装 `lunar-javascript`，输入 `YYYY-MM-DD`，输出 `{ gregorian: string[], lunar: string[], solarTerm: string | null }`。
- 公历固定节日（元旦、情人节、妇女节、劳动节、儿童节、国庆节、圣诞节等）与浮动节日（母亲节、父亲节、感恩节）在本地表中维护；农历节日与二十四节气由库计算。
- 支持范围限定在库可靠覆盖的年份（约 1900–2100）；超出范围或计算异常时返回空特征，并在提示中标记「无已知日期特征」，禁止模型自行编造。
- 日期特征只与目标日期有关，不读取请求时的当前时间，避免跨时区/跨日生成不一致。

替代方案：Rust 侧用农历 crate 计算。被否决：需要再维护一套节日表，且前端详情页也需要展示日期特征，统一在 TS 侧更省重复。

### 12. Git 发布使用系统 Git CLI，所有操作显式参数化

- 通过 `git -C <worktree> ...` 调用系统 Git；参数以数组传递，不经过 shell，避免注入。检查 `git --version`，缺失时给出安装指引。
- 设置 `GIT_TERMINAL_PROMPT=0`，让凭据缺失快速失败而不是卡住 GUI；认证交给系统 credential helper 或 SSH Agent，应用不读取、不保存 token。
- 发布前检查：
  1. 工作副本存在且 `origin` 与配置一致；不存在则 clone。
  2. `git fetch --prune origin`；本地落后且无本地提交时 `git merge --ff-only origin/<branch>`。
  3. `git status --porcelain=v1 -z`：只允许 `data/calendar.json` 与 `data/photos/` 范围内的改动；其他改动存在则停止。
  4. 本地与远端分叉时停止，绝不 `push --force`。
- 提交：只 `git add -A -- data/calendar.json data/photos`；`git diff --cached --quiet` 判断是否有内容；提交信息如 `calendar: update 2026-11-08` 或 `calendar: publish N entries`。
- 推送：`git push origin HEAD:<branch>`；失败时保留本地提交，UI 标记「有未发布改动」。重试时先检查是否已有未推送提交，避免重复提交。
- 发布后显示提交哈希、时间和 Pages 链接；Pages 构建是异步的，不谎报「已上线」。无法读取 Actions 状态时只给 Actions 页面入口。
- 兼容性校验：目标工作副本必须有 `data/` 与 Pages 工作流；空仓库允许创建最小 `data/calendar.json`，但提示还需要模板初始化展示页与工作流。

替代方案：`git2`/libgit2。被否决：跨平台 SSH/凭据助手支持不如系统 Git，且用户机器上的 Git 配置本来就是最可靠的认证来源；代价是要求用户安装 Git，已在设置与文档中显式说明。

### 13. 配置与密钥：非敏感配置用 JSON，敏感信息用系统钥匙串

配置目录由 `directories` crate 解析：

- Windows：`%APPDATA%\PhotoCalendar\config.json`
- Linux：`$XDG_CONFIG_HOME/photo-calendar/config.json`（默认 `~/.config/photo-calendar/`）
- 数据/缓存/日志：各自的平台数据目录；临时预览放缓存目录并在启动时清理。

```json
{
  "version": 1,
  "deepseek": {
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-flash"
  },
  "git": {
    "remoteUrl": "",
    "branch": "main",
    "worktreePath": "",
    "autoPublish": true,
    "siteUrl": ""
  }
}
```

- API Key 存于 `keyring` 的 service `com.photocalendar.editor`、account `deepseek`。Linux 使用 Secret Service；不可用时只允许会话内临时密钥并明确警告，绝不写明文文件。
- 配置写入采用临时文件 + 原子替换；解析失败时备份损坏文件并以空配置启动，不覆盖照片数据。
- 设置校验：URL 协议、Git 引用格式、绝对路径、非空模型；连接测试超时 15 秒。
- 更换仓库/工作副本时，如果有待发布改动或发布进行中，阻止切换或要求先确认；不删除旧目录数据。

### 14. 展示端与编辑端的测试分层

- `packages/shared`：日期解析/加减/月矩阵、FNV 哈希、确定性选择、zod 契约、路径校验。使用固定 fixture 与已知哈希值。
- `apps/web`：Vitest + jsdom 测数据加载失败降级、XSS 文案按文本渲染、回退稳定性、非法参数；Playwright 测月历/单日导航、移动/桌面视口、键盘、`prefers-reduced-motion`、子路径部署。回退模块加 lint 规则禁止 `Math.random`。
- Rust：`kamadak-exif` 解析 fixture、8 种方向、无偏移日期、批量冲突、WebP 尺寸、EXIF 白名单重建与禁止标签校验、原子写入、文案去重/长度、路径穿越、配置校验、Git porcelain 解析。
- Git 集成测试：临时裸仓库 + 临时工作副本，覆盖 clone、提交、成功推送、认证失败模拟、非快进拒绝、脏工作区阻断；不连接真实 GitHub。
- DeepSeek 测试：`wiremock`/`httpmock` 模拟成功、重复文案、401、429、超时、内容拒绝；CI 不调用真实 API。真实 Key 只用于人工冒烟。
- CI：Node 22 + pnpm + Rust stable；PR 跑 web 单测、E2E（Linux）、`cargo test`、`cargo clippy`、`cargo fmt --check`。Tauri 安装包在 `ubuntu-latest` 与 `windows-latest` 上分别构建并上传 artifact。
- 人工验收：Windows 11 与一台 Linux 桌面各完成一次导入、生成、覆盖、发布；确认 Pages 在推送后更新。

### 15. 发布与部署流程

- `pages.yml`：push 到 `main` 或手动触发；`actions/checkout` -> pnpm 安装 -> `pnpm --filter @photo-calendar/web build` -> `actions/configure-pages` -> `actions/upload-pages-artifact`（`apps/web/dist`）-> `actions/deploy-pages`。权限仅 `contents: read`、`pages: write`、`id-token: write`，并发组防止重叠部署。
- Vite 插件在构建时把仓库根 `data/` 复制到 `dist/data/`；Pages 产物自带数据，不依赖额外步骤。
- `ci.yml`：PR 与 push 运行单测、类型检查、Rust 检查与 Web E2E；不部署。
- `editor-build.yml`：手动或 tag 触发，Windows/Linux 矩阵构建 Tauri 安装包，上传 artifact；首版不要求代码签名，文档说明 Windows SmartScreen 与 Linux 包依赖。
- 本地开发：`pnpm dev:web`（Vite 开发服务器，插件把 `/data/` 指向仓库根）、`pnpm dev:editor`（Tauri dev）。数据初始为空清单，页面显示回退内容。

### 16. 错误状态与恢复策略

统一错误码（前端展示中文文案，诊断日志保留 code）：

- `CONFIG_MISSING` / `CONFIG_INVALID`
- `SECRET_MISSING` / `KEYCHAIN_UNAVAILABLE`
- `DEEPSEEK_AUTH` / `DEEPSEEK_QUOTA` / `DEEPSEEK_RATE_LIMIT` / `DEEPSEEK_TIMEOUT` / `DEEPSEEK_REFUSED` / `DEEPSEEK_INVALID_RESPONSE`
- `GIT_NOT_FOUND` / `GIT_AUTH` / `GIT_DIVERGED` / `GIT_DIRTY` / `GIT_PUSH_REJECTED` / `GIT_NETWORK`
- `REPO_INCOMPATIBLE` / `DATA_INVALID` / `IMAGE_INVALID` / `IMAGE_TOO_LARGE` / `EXIF_METADATA_FAILED`
- `CAPTION_DUPLICATE` / `CAPTION_INVALID`

恢复原则：本地已保存的内容优先保留；网络/推送失败只改变「待发布」状态，不回滚已保存条目；覆盖/删除在确认前不执行；失败弹窗必须给出下一步动作（重试、打开设置、打开 Actions、重新选择日期），而不是只显示错误字符串。

## Risks / Trade-offs

- **GitHub Pages 的 Open Graph 元数据可能抓不到动态内容** → 单日页由客户端更新 meta，分享预览可能退回默认站点信息。首版接受；若日后必须，可在构建期为每个条目预渲染静态 HTML。
- **css-doodle 依赖第三方 CDN** → 固定版本（0.38.4）并实现 CSS 降级；CDN 故障时页面仍可读。代价是图样在离线/CDN 被墙时不可见。
- **无照片日期的内容会随语句/图样库更新而改变** → 契约只承诺同一部署版本内稳定。若需要永久稳定，必须冻结内容库或把版本写入数据；首版不做，发布说明中提示。
- **WebP 有损编码依赖 libwebp 构建** → 若 Windows/Linux 构建出现工具链问题，允许在不改变外部行为的前提下回退为 JPEG，并同步调整扩展名与校验器；这是实现期需要验证的风险点。
- **WebP 的 EXIF 写入需要扩展容器** → libwebp 有损编码常输出 simple WebP，而 `little_exif` 只接受 extended WebP；实现需在写入前补 `VP8X` 容器，并用 `kamadak-exif` 读回校验标签集合。若该路径不可靠，沿用既有 JPEG 回退并保持同一白名单。
- **白名单刻意不含机身品牌/型号与序列号** → 用户可能希望在图片属性中看到相机型号或镜头序列号；这是为满足「只保留时间/镜头/曝光」的隐私选择。若未来需要新增字段，必须先更新数据契约与规格。
- **HEIC/RAW 不支持** → 对 iPhone 默认格式用户不友好。首版用明确错误提示与「先导出为 JPEG」文档缓解；后续再评估 `libheif` 的跨平台成本。
- **自动发布默认开启可能让网络错误频繁打断流程** → 发布失败不回滚本地保存，只标记待发布；用户可关闭自动发布改为手动批量发布。
- **要求安装系统 Git** → 应用无法完全自包含；设置页与首次发布检查会给出安装指引。相比集成 libgit2，这换来了更可靠的凭据/SSH 兼容性。
- **Git 仓库体积随照片增长** → 发布图已压缩且不含原图，单张通常数百 KB；长期仍会增长，后续可用 Git LFS 或外部存储。首版不引入 LFS 以降低复杂度。
- **EXIF 无时区偏移时按墙钟日期计算** → 旅行照片在极端情况下可能被归到与技术 UTC 日期不同的一天；这是最符合用户直觉的选择，并允许手动改日期兜底。
- **Tauri 在 Linux 上的 WebKitGTK/Secret Service 差异** → CI 只覆盖构建，真实桌面环境需人工冒烟；钥匙串不可用时降级为会话密钥而不是明文。

## Migration Plan

这是空仓库的首个变更，没有既有数据需要迁移；按以下顺序落地可将风险前置：

1. **先建站点骨架与 Pages**：根工作区、`apps/web`、`data/` 空清单、`pages.yml`。推送后确认 GitHub Pages 子路径可打开月历与单日页，确认 css-doodle 与 fallback 正常。
2. **再建共享契约与编辑器骨架**：`packages/shared`、Tauri 窗口、配置/钥匙串、图库读取空清单；在 Windows 与 Linux 各启动一次。
3. **实现导入与文案**：先本地保存、不发布；用真实照片覆盖有/无 EXIF、元数据白名单、覆盖冲突、手动文案、刷新去重。
4. **最后接入 Git 发布**：先在临时裸仓库演练 clone/commit/push/失败恢复，再指向真实站点仓库；开启自动发布前用一次手动发布验证 Pages。
5. **发布后验证**：检查 `data/calendar.json`、照片路径、Pages 构建日志与线上日期；若失败，回滚对应提交，Pages 会重新部署上一版本。

回滚策略：数据格式保持 `version: 1`，回滚只需 revert 内容提交或恢复旧 `calendar.json`；编辑器不会强推，Git 历史即为备份。若未来引入 schema 迁移，必须先写备份/迁移测试，再允许编辑器写入新版本。

