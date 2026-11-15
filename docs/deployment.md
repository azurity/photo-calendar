# 部署到 GitHub Pages

## 一次性设置

1. 把项目推送到 GitHub 仓库的 `main` 分支。
2. 打开仓库 **Settings → Pages → Build and deployment**，Source 选择 **GitHub Actions**。
3. 确认仓库允许 Actions 运行；`pages.yml` 需要 `pages: write` 与 `id-token: write` 权限，工作流已声明。
4. 推送后 Actions 会运行 **Deploy web to GitHub Pages**：安装依赖、构建 `packages/shared` 与 `apps/web`、上传 `apps/web/dist`、部署。

站点地址通常是：

```text
https://<owner>.github.io/<repo>/
```

项目页部署在子路径下，页面使用相对链接和查询参数，不需要额外的 `base` 配置或服务端重写。

## 本地验证

```bash
pnpm install
pnpm build:web
npx serve apps/web/dist
```

`apps/web/dist/data/` 应包含 `calendar.json` 与照片；如果没有，检查 Vite 数据插件的 `closeBundle`。

## 编辑器发布链路

编辑器把 `data/calendar.json` 与 `data/photos/**` 提交到站点仓库的发布分支，然后推送。GitHub Actions 看到 `main` 上的新提交后重新构建并部署 Pages。Pages 构建是异步的，推送成功后通常还需要几十秒到几分钟。

编辑器不会声称页面已立即更新；它显示提交哈希、线上站点链接与 Actions 入口。

## 回滚

- **内容回滚**：在仓库中 revert 对应的 `calendar: publish entries` 提交，或恢复旧的 `data/calendar.json` 与照片，然后推送；Actions 会重新部署上一版本。
- **代码回滚**：revert 前端/工作流提交；Pages 会重新构建。
- 编辑器从不强制推送，因此 Git 历史就是发布备份。

## 常见问题

- **页面 404**：确认 Pages Source 为 GitHub Actions，并检查 Actions 是否成功。
- **资源路径错误**：确认没有使用以 `/` 开头的绝对路径；项目页必须相对部署。
- **照片不更新**：照片文件名带内容哈希，正常情况会生成新 URL；若未更新，检查 `calendar.json` 是否指向新文件。
- **数据仍是旧的**：页面请求带 `updatedAt` 版本参数；确认工作流确实在数据提交后重新构建。
