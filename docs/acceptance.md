# 验收记录

日期：2026-11-16（Asia/Shanghai）。本记录对应 `build-photo-calendar` 的规格场景；真实 GitHub Pages 与两端 CI 已执行。

| 验收项 | 结果 | 证据/说明 |
| --- | --- | --- |
| 月历渲染、翻月、今天、非法月份回退 | 通过 | Playwright `calendar.spec.ts`；2026-11 共 30 个日期格 |
| 单日页有照片、无照片、相邻导航、非法日期 | 通过 | Playwright + Vitest `day.test.ts` |
| 无照片内容确定性 | 通过 | 同一日期刷新 E2E；FNV-1a 固定快照测试 |
| css-doodle CDN 阻断降级 | 通过 | Playwright 拦截 `unpkg.com`，`.pattern-fallback` 可见 |
| 移动端 375px / 桌面 1440px | 通过 | Playwright 无横向滚动断言 |
| 键盘焦点、axe 可访问性 | 通过 | `test:a11y` 3 页无严重违规；月历日期链接可聚焦 |
| 数据缺失/非法 JSON/非法条目 | 通过 | `data.test.ts`；月历/单日页降级不白屏 |
| 照片 404 降级 | 通过 | 单日/月历 Playwright 与 DOM 测试 |
| EXIF 日期映射（偏移/无偏移/跨零点/缺失） | 通过 | Rust 单元测试 |
| EXIF 方向 8 种 | 通过 | Rust `applies_all_eight_exif_orientations` |
| 主图 EXIF 白名单、缩略图无 EXIF | 通过 | Rust GPS/机身/序列号/软件/MakerNote 剥离测试 |
| 单日唯一、覆盖确认、取消保持 | 通过 | Rust 冲突/覆盖/回滚测试 |
| 批量同日冲突 | 通过 | Rust `previews_batch_conflicts_and_existing_entries` |
| 导入→保存→Git 发布 | 通过 | Rust 临时裸仓库集成测试（文案使用固定文本，未调用真实 DeepSeek） |
| 文案刷新去重、401/429、重复三次 | 通过 | `wiremock` 测试 |
| 海报式发布状态与失败恢复 | 通过 | Rust Git 分叉/脏工作区/推送错误测试；真实 Pages 部署成功 |
| CI 首次运行 | 通过 | run `43740567219`：Web lint/typecheck/单测/E2E 与 Rust fmt/clippy/test 全绿 |
| 真实 GitHub Pages | 通过 | <https://azurity.run/photo-calendar/>，部署 run `43740567201`，提交 `298a7f8`（内容）/`26ae995`（代码） |
| 线上照片日期 | 通过 | <https://azurity.run/photo-calendar/day.html?date=2026-11-08>：标题、文案、1600×1067 主图与 OG image 正确 |
| Windows/Linux 编辑器构建 | 通过 | run `43740572424`：Windows `.msi`/`setup.exe`，Linux `.deb`/`.rpm`/`.AppImage` 均上传 artifact |
| 编辑器设置/图库/导入/详情/发布 UI | 通过 | Vitest + jsdom 的 17 个 UI 场景，覆盖校验、筛选、冲突、生成、删除、发布失败与并发点击 |
| 编辑器 axe/键盘 | 通过 | axe 主视图无 serious/critical 违规；导航按钮可聚焦 |
| 离线导入/手动文案 | 代码路径已实现，未在真实断网环境执行 | 导入与保存不依赖网络；生成/发布会提示配置或网络错误 |
| Windows 安装与发布 | 跳过（用户决定） | 用户明确跳过 Windows 11 手动安装验证；Windows CI 构建与 `.msi`/`setup.exe` 产物已通过 |
| Linux 安装包 | 通过（构建） | 生成 `.deb`/`.rpm`/`.AppImage`；未做系统级安装冒烟 |

## 已知偏差

1. Windows 11 手动安装、导入、生成、发布验证已由用户明确跳过；Windows CI 构建与安装包验证已通过。真实 DeepSeek Key 生成与真实断网环境仍属人工可选项。
2. 为验证线上照片渲染，仓库当前包含一张生成的渐变示例图（2026-11-08），可在编辑器中删除后重新发布。
3. 社交平台抓取 Open Graph 元数据仍受纯静态站限制，客户端更新 meta 只能尽力而为。
4. 首版不支持 HEIC/RAW。
5. `pnpm install` 在只读 HOME 的沙箱中需使用 `npx pnpm@9.15.9 install` 或可写 store；`pnpm dev:editor` 已通过仓库内包装脚本适配此环境。
