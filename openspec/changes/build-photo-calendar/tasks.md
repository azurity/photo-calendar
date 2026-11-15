# Tasks

## 1. 工作区与基础工程

- [x] 1.1 建立 pnpm workspace、根 `package.json`、TypeScript 基础配置、`.gitignore` 与 `.editorconfig`；验证：`pnpm install` 成功，`pnpm -r list --depth -1` 能列出 web、editor、shared 三个工作区包
- [x] 1.2 创建 `apps/web`、`apps/editor`、`packages/shared` 的最小 Vite/TypeScript/Tauri 骨架与构建脚本；验证：`pnpm -r typecheck` 与 `pnpm -r build` 通过
- [x] 1.3 配置 ESLint、Prettier、Vitest 与聚合脚本 `pnpm check`；验证：`pnpm lint`、`pnpm format:check`、`pnpm test:unit` 全部通过（含至少一个 smoke test）
- [x] 1.4 编写根 `README.md` 的开发前置与命令（Node 22+、pnpm、Rust、系统 Git、Linux Tauri 依赖）；验证：按 README 在干净 shell 中完成安装与 `pnpm build:web`，命令无缺漏
- [x] 1.5 增加 `.github/workflows/ci.yml` 的基础任务（安装、lint、typecheck、单测）；验证：workflow YAML 通过 actionlint/解析检查，且本地等价的 `pnpm check` 通过

## 2. 共享契约与确定性核心

- [x] 2.1 实现严格日期工具（解析、格式化、加减、星期、月矩阵），不使用 UTC 隐式转换；验证：Vitest 覆盖闰年、月末、非法日期与跨年边界并通过
- [x] 2.2 实现 FNV-1a 哈希与「日期 + 域 + 库长度」的确定性选择函数；验证：固定输入的哈希/索引快照测试通过，回退模块源码无 `Math.random`
- [x] 2.3 定义 manifest/entry 的 zod schema、TypeScript 类型、字段上限与路径校验；验证：合法 fixture 通过，重复日期、非法日期、越界路径、空文案、未知主版本逐个报错
- [x] 2.4 建立 `packages/shared/fixtures/` 的合法/非法样本与 fixture 加载测试；验证：每个样本都有期望结果断言，`pnpm --filter @photo-calendar/shared test` 通过
- [x] 2.5 创建 `data/calendar.json` 空清单与 `data/photos/.gitkeep`；验证：清单通过 schema 校验，Web 数据加载测试能读取该文件
- [x] 2.6 编写 `docs/data-contract.md`（字段、路径、版本、隐私规则、主图 EXIF 白名单与缩略图无 EXIF 约束），并让文档示例成为被测试的合法 fixture；验证：文档示例与 fixture 一致且 fixture 测试通过
- [x] 2.7 建立 shared 包公共导出与 README，确保 web/editor 只从公共入口导入；验证：`pnpm --filter @photo-calendar/shared build` 成功，两个应用 typecheck 通过

## 3. Web 基础与月历

- [x] 3.1 配置 Vite 多页构建与数据插件（开发时提供 `/data/`，构建时复制 `data/` 并注入 `__CALENDAR_VERSION__`）；验证：`pnpm dev:web` 可请求 `/data/calendar.json`，`pnpm build:web` 后 `dist/data/calendar.json` 与 `index.html`、`day.html` 均存在
- [x] 3.2 实现共享页面壳、站点标题、导航、设计 token 与响应式基础样式；验证：构建产物无 404，375px 与 1440px 视口下无横向滚动
- [x] 3.3 实现数据加载器（版本参数、schema 校验、加载/错误状态、照片 404 降级钩子）；验证：mock fetch 单测覆盖成功、404、非法 JSON、非法 schema 四类情况
- [x] 3.4 实现月历矩阵渲染（周一首日、今天与选中标记、有图缩略图、无图空格子）；验证：针对 2026-11、跨月边界与空数据的 DOM 单测通过
- [x] 3.5 实现月份查询参数解析、前后月/今天导航与 URL 同步；验证：合法/非法月份单测以及浏览器返回/前进行为测试通过
- [x] 3.6 实现日期格到单日页的链接与键盘操作；验证：鼠标点击和 Enter 均跳转 `day.html?date=...`，焦点样式可见
- [x] 3.7 为月历补充 Playwright 响应式与可访问性测试（375/1440、Tab 导航、axe）；验证：`pnpm --filter @photo-calendar/web test:e2e -- month` 通过
- [x] 3.8 在 `apps/web/README.md` 记录月历数据来源、URL 约定与本地开发方式；验证：README 中的命令可直接运行，数据路径与实现一致

## 4. Web 单日页与确定性回退

- [x] 4.1 编写不少于 40 条固定寄语，主题为感性、巧思、引导探索世界；验证：单测检查数量、长度、去重，并完成一次人工语气评审
- [x] 4.2 编写不少于 12 个 css-doodle 图样片段（无动画、可由固定 seed 渲染）；验证：每段非空、可渲染，截图检查图样不遮挡文字
- [x] 4.3 实现按日期确定寄语、图样与 seed 的选择模块；验证：固定日期快照、同日多次调用一致、不同日期可不同，且无 `Math.random`
- [x] 4.4 实现有照片单日页（主图、日期、星期、文案、alt、相邻日期导航）；验证：DOM 单测与 Playwright 断言通过
- [x] 4.5 实现无照片单日页（寄语为主体、css-doodle 背景、遮罩保证对比度）；验证：无照片 fixture 下不请求照片，对比度检查通过
- [x] 4.6 实现固定版本 CDN 加载 css-doodle、2 秒失败降级与纯 CSS 背景；验证：Playwright 拦截 CDN 请求后页面仍可读，控制台无未捕获错误
- [x] 4.7 处理非法日期、照片 404、数据无效与加载失败；验证：各场景单测/端到端测试通过，页面回退而不白屏
- [x] 4.8 实现标题/描述/OG meta 动态更新与文案纯文本渲染；验证：含 HTML 的文案按字面显示，meta 更新单测通过
- [x] 4.9 补充 `prefers-reduced-motion` 与移动端单日页布局测试；验证：reduced motion 下无动画，375px 下无横向滚动
- [x] 4.10 在 Web README 记录回退内容机制与内容库版本规则；验证：文档描述的 seed 与库版本常量与代码一致

## 5. Web 部署与端到端

- [x] 5.1 编写 `pages.yml`（构建、configure-pages、upload-pages-artifact、deploy-pages、权限与并发）；验证：actionlint 通过，构建步骤与本地 `pnpm build:web` 等价
- [x] 5.2 扩展 `ci.yml` 运行 Web 单测、typecheck、Playwright 与 Rust 基础检查；验证：本地等价命令全绿，CI 首次运行通过
- [x] 5.3 用本地静态服务器把 `dist/` 挂在 `/photo-calendar/` 子路径，验证所有页面、数据与照片；验证：Playwright 子路径套件通过
- [x] 5.4 加入 axe、键盘与对比度检查并修复发现的问题；验证：`pnpm test:a11y` 无严重违规
- [x] 5.5 编写 `docs/deployment.md`（Pages 设置、Actions、子路径、回滚）；验证：按文档从空测试仓库部署一次成功
- [x] 5.6 手动触发一次 Pages 工作流并用真实链接验证月历/单日页；验证：线上 URL 可打开，数据与照片正确，记录 URL 与提交哈希

## 6. 编辑器外壳、设置与密钥

- [x] 6.1 创建 Tauri 2 工程、窗口配置、capabilities、图标与 `dev:editor`/`build:editor` 脚本；验证：`cargo check` 通过，Linux 上 `pnpm dev:editor` 能启动窗口
- [x] 6.2 实现配置模块（平台目录、默认值、版本、原子写、损坏备份）；验证：临时目录单测覆盖首次创建、重启读取、坏 JSON、只读失败
- [x] 6.3 实现密钥模块（keyring 服务/账户、读写清除、不可用时仅会话密钥）；验证：内存实现单测通过；Linux 无 Secret Service 时行为符合规格
- [x] 6.4 实现 `settings_get`/`settings_save`、`secret_*` 与带 15 秒超时的 `settings_test_deepseek`/`settings_test_git` 命令；验证：mock HTTP 与本地裸仓库集成测试通过
- [x] 6.5 实现设置界面（字段、掩码、校验错误、连接测试、保存/清除）；验证：前端状态单测覆盖校验与保存，手动操作覆盖成功/失败路径
- [x] 6.6 实现首次运行引导与未配置状态的禁用/提示；验证：空配置启动时导入可用，生成与发布显示正确的配置提示
- [x] 6.7 在 Windows 与 Linux CI 上编译 Tauri 壳并检查目录/钥匙串特性；验证：两端 CI 构建通过，记录平台差异
- [x] 6.8 编写 `docs/editor-settings.md`（前置、配置项、密钥存储、平台差异）；验证：文档步骤在 Linux 上逐步执行成功

## 7. 数据层与图库

- [x] 7.1 在 Rust 中实现 manifest/entry 结构、serde 解析与显式校验（重复日期、坏日期、路径、文案）；验证：与 shared fixtures 对齐的 Rust 测试全部通过
- [x] 7.2 实现原子清单写入与 `updatedAt` 单调推进；验证：写入失败/中断模拟后文件仍可解析，连续保存的时间戳递增
- [x] 7.3 实现孤立照片清理（仅匹配本应用命名模式）；验证：孤立、被引用、未知文件三类样本的清理结果符合预期
- [x] 7.4 实现 `entries_list`/`entry_get`/`entry_delete`/`caption_save` 命令；验证：临时工作副本集成测试覆盖读取、删除、手动文案标记
- [x] 7.5 实现图库视图（日期倒序、缩略图/日期/摘要、年月筛选、空状态）；验证：前端单测覆盖筛选与空状态，手动检查大列表
- [x] 7.6 实现条目详情、删除确认、手动文案编辑与错误提示；验证：取消/确认/保存失败路径的测试通过
- [x] 7.7 实现版本迁移框架（当前 v1，未来主版本拒绝/迁移）；验证：v1 读写、v2 拒绝、迁移 fixture 测试通过
- [x] 7.8 编写 `docs/data-layer.md` 或在 `data-contract.md` 中补充原子写、清理、迁移；验证：文档与实现函数/命令一致

## 8. 照片导入与 EXIF

- [x] 8.1 实现 EXIF 解析（DateTimeOriginal/Digitized/DateTime、偏移、镜头与曝光白名单、损坏/缺失）；验证：多组 fixture 的 Rust 单测覆盖每个时间回退分支与白名单字段提取
- [x] 8.2 实现拍摄日期映射（带偏移、无偏移、跨零点、手动日期）；验证：单测断言日期与 `date` 字段，无 UTC 平移错误
- [x] 8.3 实现格式/大小/像素限制与 EXIF 方向校正；验证：8 种方向 fixture、超大图、伪造像素尺寸的测试通过
- [x] 8.4 实现 2400/640 双尺寸 WebP 与内容哈希命名，编码阶段不保留原 EXIF；验证：输出尺寸/格式/文件名测试通过，编码结果不含原图 EXIF
- [x] 8.5 实现 EXIF 白名单重建与 WebP 写入（扩展 VP8X、`little_exif`、主图白名单、缩略图无 EXIF、方向标签移除）；验证：含 GPS/机身型号/序列号/所有者/软件/备注/MakerNote/XMP 的 fixture 输出只含白名单；镜头/曝光值一致；缩略图无 EXIF；Orientation 不保留；写入失败中止保存
- [x] 8.6 实现 `photos_preview_import`（批量解析、冲突、临时预览、不写正式数据）；验证：批内同日、已有条目、无效文件的集成测试通过
- [x] 8.7 实现保存事务（新资源、清单、旧资源清理、失败回滚）；验证：覆盖成功/取消/中途失败测试通过，清单始终可解析
- [x] 8.8 实现导入 UI（选择器/拖放、草稿、手动日期、冲突对比、进度）；验证：前端状态测试通过，手动 Tauri 导入包含多张照片的批次
- [x] 8.9 实现离线导入与手动文案路径；验证：断网环境导入并保存成功，生成按钮提示离线或未配置
- [x] 8.10 编写 `docs/photos.md`（支持格式、EXIF 语义、元数据白名单、HEIC/RAW 限制、尺寸与隐私）；验证：文档限制与错误信息一致

## 9. DeepSeek 文案生成

- [x] 9.1 实现日期特征模块（公历/农历节日、节气、范围保护）；验证：元旦、春节、节气与超范围日期的单测通过
- [x] 9.2 实现提示词构建器与版本常量（画面、日期、刷新上一版、引用规则）；验证：快照测试包含必要字段，且不包含本地路径或 GPS
- [x] 9.3 实现 DeepSeek HTTP 客户端与错误映射（401/402/429/5xx/超时/拒绝）；验证：mock server 测试每个状态码与超时路径
- [x] 9.4 实现发送图预处理（1568 长边、JPEG q80、≤2 MiB、完全去元数据，含发布主图白名单字段也不发送）；验证：大图/GPS/带镜头曝光的图输出尺寸、体积与“零 EXIF”测试通过
- [x] 9.5 实现响应清洗与合规校验（空、Markdown、超长、非中文）；验证：各类异常响应的单测通过
- [x] 9.6 实现刷新去重（归一化、最多 3 次、保留旧文案）；验证：重复→重试→成功与三次重复失败的 mock 测试通过
- [x] 9.7 实现 `caption_generate` 命令与 UI（生成、换一句、接受/取消、手动编辑保护、生成元数据）；验证：前端状态测试通过，手动生成与刷新各一次
- [x] 9.8 实现错误 UI（设置入口、重试、429 等待）与并发防抖；验证：断网、401、连续点击的测试/手动检查通过
- [x] 9.9 编写 `docs/caption-generation.md`（模型、提示词版本、隐私、错误与费用）；验证：文档中的配置项与错误码与实现一致

## 10. Git 发布

- [x] 10.1 实现 Git 命令封装（无 shell 拼接、超时、环境变量、输出脱敏）；验证：注入含凭据 URL 的测试中，日志与错误均不出现明文
- [x] 10.2 实现仓库校验、克隆、origin/分支一致性检查；验证：临时裸仓库测试覆盖首次克隆、远端不匹配、分支不存在
- [x] 10.3 实现发布前同步与脏工作区/分叉检测；验证：领先、落后、分叉、存在无关修改四类临时仓库测试通过
- [x] 10.4 实现受控暂存、提交信息与幂等重试；验证：只提交 `data/` 范围，重复发布不产生重复提交
- [x] 10.5 实现推送成功、认证失败、非快进拒绝与网络失败的错误映射；验证：临时远端与故障注入测试通过，任何路径都不强推
- [x] 10.6 实现发布锁、进度事件、自动发布开关与待发布状态；验证：并发点击只运行一个进程，发布失败后本地条目仍可读
- [x] 10.7 实现发布状态 UI（提交哈希、时间、Pages 链接、Actions 入口、重试）；验证：成功/失败/部署状态不可用的前端测试通过
- [x] 10.8 编写 `docs/git-publishing.md`（凭据、同步策略、冲突处理、Pages 延迟、回滚）；验证：按文档在测试仓库完成一次发布和一次人为冲突恢复

## 11. 编辑器集成与跨平台

- [x] 11.1 串联应用壳、导航、全局错误码与恢复动作；验证：前端状态测试覆盖四个视图与错误提示
- [x] 11.2 在临时站点仓库完成「导入→生成→保存→自动发布」集成测试；验证：Rust/前端集成测试通过，远端出现提交与正确数据
- [x] 11.3 验证自动发布开/关、离线保存、失败重试的完整状态机；验证：状态机单测与手动断网流程通过
- [x] 11.4 实现中文界面一致性、键盘操作与焦点管理；验证：axe/键盘测试通过，关键流程可全键盘完成
- [x] 11.5 编写 Windows/Linux Tauri 构建工作流并上传安装包；验证：两端 CI 成功产出 artifact
- [ ] 11.6 在 Windows 11 与 Linux 桌面各完成一次安装、导入、生成、发布；验证：记录系统版本、构建产物与结果
- [x] 11.7 编写发布/安装文档（SmartScreen、Linux 依赖、升级、卸载）；验证：按文档在两种平台安装成功

## 12. 集成验收

- [x] 12.1 运行 Web 全量检查（lint、typecheck、unit、e2e、a11y、build）；验证：`pnpm check:web` 全绿
- [x] 12.2 运行 Rust 全量检查（fmt、clippy、test）；验证：`cargo fmt --check`、`cargo clippy -- -D warnings`、`cargo test` 全绿
- [x] 12.3 运行编辑器前端全量检查与 Tauri 构建；验证：`pnpm check:editor` 与 `pnpm build:editor` 成功
- [x] 12.4 用真实 GitHub Pages 仓库完成一次端到端发布并访问线上日期页；验证：线上数据、照片、文案与提交一致，记录 URL/哈希
- [x] 12.5 按 specs 的验收场景做一次逐项人工核对（移动端、无照片日期、CDN 阻断、覆盖、元数据白名单、刷新去重、离线、失败恢复）；验证：验收清单全部勾选或记录已知偏差
- [x] 12.6 核对 README、部署、数据契约与编辑器文档的链接与命令；验证：文档中的每条命令可执行，无失效路径

## Workflow follow-up

- Archive the change after implementation and verification are complete.
- Run `openspec validate build-photo-calendar` before archiving.
