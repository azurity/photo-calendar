# 编辑器构建与安装

## 本地构建

```bash
pnpm install
pnpm --filter @photo-calendar/editor tauri build
```

产物位于 `apps/editor/src-tauri/target/release/bundle/`：

- Windows：NSIS `.exe` 与/或 MSI（取决于本机 WiX 工具）。
- Linux：AppImage、`.deb` 等（取决于系统打包工具）。

CI 的 `.github/workflows/editor-build.yml` 会在 `ubuntu-22.04` 与 `windows-latest` 上分别构建并上传 artifact。

## Windows

- 安装包未做代码签名，首次运行可能出现 **Windows SmartScreen** 警告；选择「更多信息 → 仍要运行」，或自行签名后分发。
- 需要 WebView2。Windows 10/11 通常自带；旧环境可安装 Evergreen WebView2 Runtime。
- 需要系统 Git，并确保 `git` 在 PATH 中；HTTPS 认证建议使用 Git Credential Manager。
- 卸载：通过「设置 → 应用」卸载；应用配置与本地工作副本不会自动删除，如需清理请手动删除 `%APPDATA%\photocalendar\photo-calendar\` 与配置中的工作副本目录。

## Linux

- 运行 AppImage 需要 FUSE；或使用 `.deb` 安装。
- 需要 WebKitGTK 4.1 运行时、GTK 3 与系统 Git。
- 若使用 `.deb`：`sudo dpkg -i photo-calendar-editor_*.deb`，依赖缺失时 `sudo apt-get -f install`。
- 卸载：`sudo apt remove photo-calendar-editor`；配置与站点工作副本需手动清理。
- 无 Secret Service 的桌面环境下，API Key 只在本次会话有效；应用会明确提示，不会写明文。

## 升级

- 安装新版本覆盖旧版本；配置文件与站点工作副本保留。
- 升级前建议先发布或备份待发布改动；数据格式当前为 `version: 1`，未来主版本会通过显式迁移处理。
- 若升级后编辑器提示数据版本过高，请升级展示端/编辑器，而不是手动改版本号。
