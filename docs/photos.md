# 照片与 EXIF

## 支持格式

- JPEG / JPG
- PNG
- WebP

首版不支持 HEIC、RAW。iPhone 用户请先在相册中导出为 JPEG。单文件上限 50 MiB，解码像素上限 100 MP。

## 拍摄日期

1. 优先 `DateTimeOriginal`；
2. 缺失时 `DateTimeDigitized`；
3. 再缺失时 `DateTime`；
4. 全缺失或 EXIF 损坏时要求用户手动选择日期，不使用文件修改时间。

存在 `OffsetTimeOriginal` / `OffsetTimeDigitized` / `OffsetTime` 时，日期按拍摄地当地日期计算，不做 UTC 平移。没有偏移时按墙钟时间取日期。`capturedAt` 只在有偏移时写入清单，且当地日期必须等于 `date`。

## 输出

- 主图：长边 ≤ 2400 像素、WebP 有损（质量约 82），文件名 `YYYY-MM-DD-<hash8>.webp`。
- 缩略图：长边 ≤ 640 像素、WebP 有损（质量约 78），位于 `data/photos/thumbs/`。
- 先按 EXIF Orientation 校正像素，输出不保留 `Orientation` 标签。
- 文件名哈希来自原图字节 SHA-256 前 8 位；替换照片会产生新 URL，避免缓存旧图。

## EXIF 白名单

主图只允许保留以下标签：

| 类别 | 标签 |
| --- | --- |
| 拍摄时间 | `DateTime`、`DateTimeOriginal`、`DateTimeDigitized`、`OffsetTime`、`OffsetTimeOriginal`、`OffsetTimeDigitized`、`SubSecTime`、`SubSecTimeOriginal`、`SubSecTimeDigitized` |
| 镜头信息 | `LensMake`、`LensModel`、`LensSpecification`、`FocalLength`、`FocalLengthIn35mmFilm` |
| 曝光参数 | `ExposureTime`、`FNumber`、`ISO`、`ExposureProgram`、`ExposureBiasValue`、`MeteringMode`、`Flash`、`ApertureValue`、`MaxApertureValue`、`ShutterSpeedValue`、`BrightnessValue`、`ExposureMode` |

显式移除：

- 全部 GPS 标签
- 机身 `Make` / `Model`
- `BodySerialNumber` / `LensSerialNumber`
- `CameraOwnerName`、`Artist`、`Copyright`
- `Software`、`ImageDescription`、`UserComment`
- `MakerNote`、内嵌缩略图
- `Orientation`、`ColorSpace`
- XMP、IPTC、ICC、注释等非 EXIF 元数据

镜头序列号被视为设备标识，不因属于「镜头信息」而保留。缩略图不写入任何 EXIF。

## 实现与失败语义

1. `kamadak-exif` 读取源图标签；
2. 构造全新的 `little_exif::Metadata`，不复制原始 EXIF 块；
3. libwebp 有损编码常输出 simple WebP；写入前补 `VP8X` 转成 extended WebP；
4. `little_exif` 写入 EXIF chunk；
5. 单元测试用 `kamadak-exif` 读回，断言标签集合恰为白名单子集、禁止标签与 GPS 不存在。

某个白名单字段损坏无法读取时可以丢弃并记录；若整个 EXIF 白名单写入失败，保存中止，保留旧条目，不发布残留禁止标签的主图。

## 隐私

- 发布图片不含 GPS、设备序列号、所有者、软件、备注等。
- `data/calendar.json` 不记录原始绝对路径，只记录仓库内相对路径。
- 生成 DeepSeek 文案时另做一份 1568 长边、完全去元数据的 JPEG，不发送发布主图保留的白名单字段。
