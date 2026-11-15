# 日历数据契约（version 1）

展示端与编辑器之间唯一的持久化接口是站点仓库根目录下的 `data/calendar.json`。所有路径均相对于仓库根目录，分隔符使用 POSIX `/`。

## 文件位置

- 数据清单：`data/calendar.json`
- 主图：`data/photos/<date>-<hash8>.webp`
- 缩略图：`data/photos/thumbs/<date>-<hash8>.webp`

## 完整示例

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

## 字段

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `version` | 是 | 当前为整数 `1`；更高主版本读取方必须拒绝并提示更新客户端。 |
| `updatedAt` | 是 | UTC ISO 8601 时间，用于展示端缓存失效；每次条目变化后单调前进。 |
| `entries` | 是 | 条目数组；同一 `date` 最多出现一次。 |
| `date` | 是 | 合法的 `YYYY-MM-DD` 公历日期。 |
| `photo` | 是 | 位于 `data/photos/` 下的主图路径。 |
| `thumbnail` | 是 | 位于 `data/photos/thumbs/` 下的缩略图路径。 |
| `caption` | 是 | 1–120 个字符的纯文本，不含 HTML、Markdown 结构或控制字符。 |
| `captionSource` | 否 | `generated` 或 `manual`。 |
| `captionModel` | 否 | 生成文案使用的模型名。 |
| `captionPromptVersion` | 否 | 生成文案使用的提示词版本。 |
| `captionUpdatedAt` | 否 | 文案最后生成/修改的 UTC 时间。 |
| `capturedAt` | 否 | 带时区偏移的 ISO 8601 拍摄时间；当地日期必须等于 `date`。 |
| `createdAt` / `updatedAt` | 是 | 条目创建与最后修改的 UTC 时间。 |

未知字段在读取时被忽略；编辑器写入时以当前字段集重写条目。

## 照片与元数据

- 主图是长边不超过 2400 像素的 WebP；缩略图是长边不超过 640 像素的 WebP。
- 主图只允许保留三类 EXIF：拍摄时间、镜头信息、曝光参数。具体白名单见 `docs/photos.md`。
- 缩略图不得包含任何 EXIF。
- GPS、机身品牌/型号、机身或镜头序列号、所有者、作者/版权、软件、备注、`MakerNote`、内嵌缩略图、方向标签、XMP/IPTC/ICC/注释等一律移除。
- 镜头与曝光信息不写入 `calendar.json`，只保留在发布主图的 EXIF 中。

## 写入与版本规则

- 写入 `data/calendar.json` 必须先写同目录临时文件，再原子替换；任何中断都只能留下旧版本或完整新版本。
- 校验失败（重复日期、非法日期、越界路径、空文案等）不得落盘。
- 当前只支持 `version: 1`；未来主版本需要迁移函数，不得静默丢弃旧条目。

## 原子写、清理与迁移

- 原子写：`tempfile` + `sync_all` + 原子重命名。
- 孤立资源清理：只删除文件名匹配 `YYYY-MM-DD-<8位十六进制>.webp` 且未被清单引用的主图/缩略图；不碰未知文件。
- 迁移：`version` 大于当前支持版本时拒绝写入；旧版本通过显式迁移函数升级并保留可映射条目。
