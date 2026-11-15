# 编辑器设置

## 前置

- Windows 10/11 或主流 Linux 桌面。
- 系统 Git（编辑器通过系统凭据管理器/SSH Agent 认证）。
- DeepSeek API Key（生成文案时必需；仅本地导入与手动文案不需要）。

## 配置项

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| DeepSeek API Base URL | `https://api.deepseek.com` | OpenAI 兼容接口根地址。 |
| 模型 | `deepseek-flash` | 需要支持图片输入。 |
| API Key | 空 | 存入系统钥匙串；不可用时仅保存在本次会话。 |
| Git 仓库地址 | 空 | HTTPS 或 SSH；不能包含明文用户名/令牌。 |
| 发布分支 | `main` | 必须已存在于远端。 |
| 本地工作副本 | 平台数据目录下的 `site` | 绝对路径；不存在时首次发布会自动克隆。 |
| 线上站点地址 | 空 | 仅用于发布后的链接。 |
| 自动发布 | 开启 | 保存照片/文案后自动提交并推送。 |

## 配置文件与目录

- Windows：`%APPDATA%\photocalendar\photo-calendar\config.json`（由 `directories` crate 解析）
- Linux：`$XDG_CONFIG_HOME/photo-calendar/config.json`（通常 `~/.config/photo-calendar/config.json`）
- 本地工作副本默认在平台数据目录下的 `site/`；缓存与临时预览在平台缓存目录。
- 测试或便携运行时可用环境变量 `PHOTO_CALENDAR_HOME` 指定一个根目录，所有配置/数据/缓存放在其下。

配置文件只保存非敏感值；API Key 不写入其中。

## API Key 安全

- 使用 `keyring` crate 写入操作系统凭据存储（Windows Credential Manager、Linux Secret Service、macOS Keychain）。
- 界面只显示 `••••••••` 加末四位，不提供复制完整密钥的入口。
- Linux 无 Secret Service 时，应用提示并只保存在本次进程内存；绝不写明文文件。
- 日志与诊断不记录认证头或完整 Key。

## 连接测试

- **测试 DeepSeek**：使用当前 Key 发送一个最小 Chat Completions 请求，15 秒超时；失败会区分 401/403、429、网络与超时。
- **测试 Git**：`git ls-remote --heads <remote> <branch>`，15 秒超时；验证远端可访问且分支存在。

## 首次运行

配置目录为空时，设置页显示默认值；导入与本地图库仍然可用。未配置 Key 时，生成按钮提示去设置；未配置 Git 时，保存后条目标记为待发布，发布入口提示先配置仓库。

## 平台差异

- Windows 使用原生文件选择器与 Credential Manager。
- Linux 使用 XDG 目录、原生文件选择器与 Secret Service；无可用钥匙串时只允许会话密钥，不会降级为明文保存。
