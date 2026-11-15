# Proposal

## Why

值得纪念的日子常常只留在相册深处：照片按拍摄时间堆叠，却很少被重新看见。这个项目把「一天一张照片」变成可长期浏览的日历——有照片的日期由照片和一句专属文字构成，没有照片的日期也有一句精心挑选的探索寄语和一幅 CSS 生成的图样，让每一天都值得被打开。展示页是纯静态站点，可直接托管在 GitHub Pages；配套桌面编辑器降低选图、写文案和发布的门槛。

## What Changes

- 在空仓库中建立 pnpm monorepo：`apps/web`（纯静态展示页）、`apps/editor`（Tauri 2 桌面编辑器）、`packages/shared`（数据契约、日期与确定性算法）、`data/`（发布数据）。
- 新增响应式静态展示站：月历页与单日页可互相跳转，支持月份/日期导航、深链接、移动端布局；有配置时以照片为主体，无配置时以固定语句库中的寄语和 `css-doodle` 图样为主体。
- 新增确定性无照片回退：以日期字符串为种子选择寄语与图样，刷新页面、更换设备或重新构建后同一天的内容保持一致；`css-doodle` 通过 CDN 加载并提供无 CDN 时的 CSS 降级。
- 新增 Tauri 桌面编辑器：导入本地照片并解析 EXIF 拍摄时间，映射到拍摄地当地日期，同时提取镜头与曝光参数；一天最多一张，冲突时在写入前明确询问是否覆盖；提供全部照片的浏览、筛选、编辑文案和删除。
- 新增 DeepSeek 文案生成：基于照片画面、日期特征（节日/节气/星期等）和固定文风提示生成感性、与画面相关的一句话；拒绝空泛模板；支持刷新且保证与刷新前的文案不同，失败时给出可恢复的错误。
- 新增 Git 发布能力：配置站点仓库、分支与本地工作副本；编辑器拉取、写入照片和数据、提交并推送，触发 GitHub Pages 重新构建；推送失败时保留本地改动并可重试，绝不强推或改写历史。
- 新增配置界面与安全存储：配置 DeepSeek API Key、模型/接口地址、Git 仓库/分支/工作副本、自动发布开关；API Key 存入系统钥匙串，界面只展示掩码，不写入仓库或日志。
- 新增共享数据契约 `data/calendar.json` 与照片资源布局：版本化、可校验、单日单条目；照片输出为 WebP 主图与缩略图，主图仅保留拍摄时间、镜头信息与曝光参数的 EXIF 白名单，其余 EXIF/GPS 及非必要元数据全部抹除，缩略图不含 EXIF。
- 新增质量保障：单元测试覆盖确定性回退、EXIF 日期映射与元数据白名单、数据校验、文案刷新去重与 Git 状态处理；Web 端到端测试覆盖月历/单日页；CI 构建 Web 并在 Windows/Linux 上构建 Tauri 安装包；提供 GitHub Pages 部署工作流与开发文档。

## Capabilities

### New Capabilities

- `calendar-display`: 静态展示站的月历与单日页、响应式布局、导航与深链接，以及无照片日期的确定性寄语与 CSS 图样回退。
- `photo-library`: 编辑器的照片导入、EXIF 时间解析与元数据白名单、单日唯一性、覆盖确认、照片浏览与条目维护。
- `caption-generation`: 通过 DeepSeek 生成与画面和日期相关的中文文案，以及刷新时避免与上一版重复的约束。
- `git-publishing`: 站点仓库配置、本地工作副本同步、提交推送与失败恢复，确保发布内容可被 GitHub Pages 构建。
- `editor-settings`: 编辑器配置界面、DeepSeek/Git 连接校验、API Key 的安全存储与跨平台可用性。
- `calendar-data`: 展示端与编辑端共享的版本化数据契约、单日单条目约束、照片资源布局与隐私处理。

### Modified Capabilities

<!-- 无：这是空仓库的首个变更，不存在已有 capability。 -->

## Impact

- **代码**：全部为新增代码——`apps/web`、`apps/editor`（含 `src-tauri`）、`packages/shared`、`data/`、`.github/workflows/` 与根目录工作区配置。
- **依赖**：Vite、TypeScript、Tauri 2、Rust（`kamadak-exif`、`little_exif`、`image`、`keyring`、`serde` 等）、`css-doodle`（CDN）、DeepSeek Chat Completions API（`deepseek-flash` 视觉模型）。不引入前端框架和自建服务端。
- **外部系统**：DeepSeek API（网络、配额与错误处理）；系统 Git 与 GitHub 凭据（HTTPS/SSH）；GitHub Pages 及其 Actions 构建。
- **兼容性**：展示页面向现代桌面与移动浏览器；编辑工具至少构建并运行于 Windows 10/11 与主流 Linux 桌面（macOS 不在验收范围）。首版支持 JPEG/PNG/WebP 照片，HEIC/RAW 暂不支持。
- **安全与隐私**：API Key 使用操作系统钥匙串；发布主图仅保留拍摄时间、镜头与曝光参数的 EXIF 白名单，缩略图不含 EXIF，GPS、机身/序列号、所有者、备注等其他元数据全部移除；仓库内不保存任何密钥。
- **不涉及**：多图/视频日程、账号体系、服务端 API、在线协同、照片精修。数据发布以 Git 为唯一通道。
