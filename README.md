# 照片日历

一天一张照片，翻到值得记住的日常。没有照片的日子，也有一句写给今天的探索寄语和一幅 CSS 图样。

项目包含两个部分：

- **展示端** `apps/web`：纯静态的月历页与单日页，可部署到 GitHub Pages，不依赖前端框架与自建服务端。
- **编辑器** `apps/editor`：Tauri 2 跨平台桌面应用，导入照片、解析 EXIF、调用 DeepSeek 生成文案，并通过 Git 发布到站点仓库。

## 目录

```text
apps/web                 Vite 多页静态站（原生 TypeScript）
apps/editor              Tauri 2 桌面编辑器
  src                    WebView 界面与调用层
  src-tauri              Rust 命令层、照片处理、DeepSeek、Git
packages/shared          日期、确定性算法、zod 数据契约
data/calendar.json       发布数据
data/photos/             发布主图与缩略图
docs/                    数据契约、部署、照片、文案、发布文档
openspec/                OpenSpec 变更与规格
```

## 开发前置

- Node.js 22+
- pnpm（仓库声明 `packageManager: pnpm@12.15.0`）
- Rust 1.77+ 与 Cargo
- 系统 Git（编辑器通过系统凭据管理器/SSH Agent 发布，不保存访问令牌）
- Linux 构建 Tauri 还需要 WebKitGTK 4.1 与相关开发包：

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

## 快速开始

```bash
pnpm install
pnpm dev:web       # http://localhost:5173
pnpm dev:editor    # Tauri 开发窗口
```

> 在只读 `HOME` 或受限容器中，若 pnpm 报 `EOF`/store lock/只读文件系统错误，请把 store 放到可写目录，或使用 `npx pnpm@9.15.9 install`（仓库锁文件为 pnpm v9 格式）。`pnpm dev:editor` 会自动把 Cargo 缓存与应用数据放到仓库内的可写目录。

如果 Linux 上缺少 WebKitGTK 4.1 开发文件，优先安装：

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

没有 apt/root 时，可运行一次 `bash scripts/setup-linux-tauri-deps.sh`；脚本会把开发包解压到 `.sysroot/`，`pnpm dev:editor` 会自动使用。

构建与测试：

```bash
pnpm build:web
pnpm build:editor
pnpm check          # lint + format + typecheck + 单元测试
pnpm test:e2e       # Web Playwright 端到端
pnpm test:a11y      # Web 可访问性检查
```

单独运行：

```bash
pnpm --filter @photo-calendar/shared test
pnpm --filter @photo-calendar/web test
pnpm --filter @photo-calendar/editor test
```

## 数据与发布

展示端读取同源的 `data/calendar.json`；照片位于 `data/photos/`，缩略图位于 `data/photos/thumbs/`。数据格式与字段约束见 [docs/data-contract.md](docs/data-contract.md)。

- 主图只保留拍摄时间、镜头信息与曝光参数的 EXIF 白名单，其余 EXIF/GPS、机身/序列号、所有者、备注等全部移除；缩略图不含 EXIF。详见 [docs/photos.md](docs/photos.md)。
- 编辑器把配置保存在平台配置目录，DeepSeek API Key 保存在系统钥匙串（不可用时仅保存在本次会话）。详见 [docs/editor-settings.md](docs/editor-settings.md)。
- 发布通过系统 Git 推送到站点仓库；推送后由 GitHub Actions 构建并部署 Pages。详见 [docs/git-publishing.md](docs/git-publishing.md) 与 [docs/deployment.md](docs/deployment.md)。

### 本地预览发布数据

`pnpm dev:web` 时，Vite 插件把仓库根 `data/` 映射到 `/data/`；`pnpm build:web` 时会把 `data/` 复制到 `apps/web/dist/data/`。站点使用相对链接与查询参数（`index.html?month=YYYY-MM`、`day.html?date=YYYY-MM-DD`），因此可直接部署在 GitHub Pages 的项目子路径下。

## 首次使用编辑器

1. 打开「设置」，填写 DeepSeek API Base URL 与模型（默认 `https://api.deepseek.com` / `deepseek-flash`），保存 API Key。
2. 配置站点仓库地址、分支与本地工作副本；工作副本不存在时首次发布会自动克隆。
3. 在「添加照片」中选择或拖入照片，确认 EXIF 日期；同一天已有照片时需要勾选覆盖。
4. 生成或手动填写文案后保存；开启自动发布时会同时推送。

没有配置 API Key 或 Git 时，照片仍可导入、保存到本地并手动填写文案。

## 平台与限制

- 编辑器至少支持 Windows 10/11 与主流 Linux 桌面；macOS 不在首版验收范围。
- 照片格式支持 JPEG、PNG、WebP；HEIC/RAW 暂不支持，请先导出为 JPEG。
- Git 认证依赖系统 Git 配置；应用不保存 HTTPS 访问令牌。
- 无照片日期的寄语与图样由日期哈希确定，同一部署版本内保持稳定；修改内容库会改变映射，属于产品变更。

## GitHub Pages

仓库包含 `.github/workflows/pages.yml`，推送 `main` 后自动构建 `apps/web` 并部署。首次使用时在 GitHub 仓库 **Settings → Pages → Build and deployment** 选择 **GitHub Actions**。完整步骤与回滚见 [docs/deployment.md](docs/deployment.md)。

## 相关文档

- [数据契约](docs/data-contract.md)
- [部署到 GitHub Pages](docs/deployment.md)
- [照片与 EXIF](docs/photos.md)
- [DeepSeek 文案](docs/caption-generation.md)
- [Git 发布](docs/git-publishing.md)
- [编辑器设置](docs/editor-settings.md)
- [编辑器构建与安装](docs/editor-release.md)
- [验收记录](docs/acceptance.md)
