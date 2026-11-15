# calendar-data Specification

## Purpose
定义展示站与编辑器共同遵守的发布数据契约：一天最多一个条目、照片与文案可被稳定定位、发布物只保留明确允许的拍摄/镜头/曝光元数据，并且格式可以在未来演进而不让旧页面崩溃。它是两个应用之间唯一的持久化接口。

## Requirements

### Requirement: 数据文件位置与顶层结构

日历数据 MUST 以 UTF-8 JSON 保存在站点仓库的 `data/calendar.json`。顶层 MUST 为对象，包含整数 `version`、ISO 8601 UTC 时间字符串 `updatedAt` 与数组 `entries`。`entries` 的每一项 MUST 描述一个日期的照片与文案；没有条目的日期不出现空对象。

#### Scenario: 合法的空数据文件

- **WHEN** `data/calendar.json` 为 `{"version":1,"updatedAt":"2026-11-15T10:00:00Z","entries":[]}`
- **THEN** 展示端与编辑端都将其视为合法数据，展示端对全部日期使用无照片回退

#### Scenario: 缺少必需字段

- **WHEN** 数据文件缺少 `version`、`updatedAt` 或 `entries`，或类型不正确
- **THEN** 校验失败，展示端降级为全部无照片状态，编辑端拒绝写入并报告字段级错误

#### Scenario: 顶层不是对象

- **WHEN** 数据文件是数组或纯文本
- **THEN** 两端均拒绝将其作为日历数据，不尝试猜测结构

### Requirement: 条目字段与完整性

`entries` 中的每个条目 MUST 包含：`date`（`YYYY-MM-DD`）、`photo`（主图路径）、`thumbnail`（缩略图路径）、`caption`（非空纯文本）、`createdAt` 与 `updatedAt`。条目 MAY 包含 `capturedAt`、`captionSource`、`captionModel`、`captionPromptVersion` 与 `captionUpdatedAt`。任何必需字段缺失或为空的条目 MUST 被视为无效。

#### Scenario: 完整条目

- **WHEN** 条目包含日期、主图、缩略图、文案、创建与更新时间
- **THEN** 展示端可以使用该条目渲染照片与文案，编辑端可以读取并继续维护

#### Scenario: 文案为空

- **WHEN** 某条目的 `caption` 为空字符串或只有空白
- **THEN** 该条目校验失败，不得在展示端以空白主体呈现

#### Scenario: 未知字段

- **WHEN** 条目包含当前版本不认识的额外字段
- **THEN** 读取方忽略未知字段并继续工作，不因额外字段拒绝整个文件

### Requirement: 单日唯一性

同一个 `date` MUST 在 `entries` 中最多出现一次。校验器 MUST 拒绝重复日期的数据；编辑器 MUST 在写入前阻止产生重复；展示端遇到重复时 MUST 只选择确定性的一条（例如按文件顺序最后一条）并向开发者记录警告，不得同时展示两张照片。

#### Scenario: 拒绝重复日期

- **WHEN** 数据文件的两个条目都为 `2026-11-08`
- **THEN** 编辑器校验失败并指出重复的日期，不继续提交

#### Scenario: 展示端遇到重复

- **WHEN** 线上数据因人工编辑出现重复日期
- **THEN** 展示端只展示其中一条，不出现两张照片叠加或交替闪烁，并在控制台给出警告

#### Scenario: 写入去重

- **WHEN** 用户尝试添加一个已有条目的日期
- **THEN** 编辑器在写入前走覆盖确认流程，数据文件中不会同时存在两个同日条目

### Requirement: 日期与拍摄时间语义

`date` MUST 是合法的公历 `YYYY-MM-DD`，且不得带时区、时间或月份补零缺失。条目包含 `capturedAt` 时，MUST 为带时区偏移的 ISO 8601 时间，且其拍摄地当地日期 MUST 与 `date` 一致。日期不使用 UTC 重新解释。

#### Scenario: 合法闰日

- **WHEN** 条目日期为 `2024-02-29`
- **THEN** 校验通过

#### Scenario: 非法日期

- **WHEN** 条目日期为 `2026-02-30` 或 `2026-13-01`
- **THEN** 校验失败，展示端不将该条目映射到任何日期格

#### Scenario: 拍摄时间与日期一致

- **WHEN** 条目日期为 `2026-11-08`，`capturedAt` 为 `2026-11-08T23:30:00+08:00`
- **THEN** 校验通过

#### Scenario: 拍摄时间与日期矛盾

- **WHEN** 条目日期为 `2026-11-08`，`capturedAt` 为 `2026-11-09T01:00:00+08:00`
- **THEN** 校验失败并报告日期与拍摄时间不一致

### Requirement: 照片资源路径

`photo` 与 `thumbnail` MUST 是相对于仓库根目录的 POSIX 路径，位于 `data/photos/` 与 `data/photos/thumbs/` 下；MUST NOT 为绝对路径、URL、包含 `..` 的路径或指向目录。两个路径 MUST 指向实际存在的文件，且同一文件 MUST NOT 被多个条目引用。

#### Scenario: 合法资源路径

- **WHEN** 条目引用 `data/photos/2026-11-08-a1b2c3d4.webp` 与 `data/photos/thumbs/2026-11-08-a1b2c3d4.webp`
- **THEN** 校验通过，两个文件均可被读取

#### Scenario: 路径穿越

- **WHEN** 条目引用 `../../secrets.png` 或 `C:\Users\me\photo.jpg`
- **THEN** 校验失败，读取方拒绝访问该路径

#### Scenario: 文件缺失

- **WHEN** 条目引用的主图或缩略图在仓库中不存在
- **THEN** 校验报告缺失文件，展示端按该日无照片降级，编辑端阻止再次发布该无效条目

#### Scenario: 资源被重复引用

- **WHEN** 两个日期条目引用同一张主图文件
- **THEN** 校验报告重复引用，要求为每个条目生成独立文件

### Requirement: 文案字段约束

`caption` MUST 为纯文本，不得包含 HTML 标签、Markdown 结构或控制字符；长度 MUST 在 1–120 个汉字（标点另计）之间。`captionSource` 存在时 MUST 为 `generated` 或 `manual`。展示端 MUST 以文本节点渲染文案内容。

#### Scenario: 纯文本文案

- **WHEN** 文案为一句普通中文描述
- **THEN** 校验通过，展示端按原样显示并保留正常标点

#### Scenario: 含 HTML 的文案

- **WHEN** 文案包含 `<b>`、`<script>` 或实体编码的标签
- **THEN** 校验器将其标记为不合规，或展示端按字面文本呈现而不执行任何标记

#### Scenario: 超长文案

- **WHEN** 文案超过 120 个汉字
- **THEN** 校验失败并说明长度限制，不静默截断用户内容

### Requirement: 隐私与最小元数据

发布数据与图片 MUST NOT 包含 GPS 坐标、设备序列号、相机所有者姓名、原始本地路径或其他不必要的个人身份信息。发布主图的 EXIF MUST 仅包含拍摄时间、镜头信息与曝光参数的白名单字段；其他 EXIF 以及 XMP、IPTC、ICC、注释等元数据 MUST 被移除，缩略图 MUST NOT 包含任何 EXIF。数据条目只允许保存渲染与维护所必需的字段；镜头与曝光信息只保留在图片元数据中，不新增到条目。

#### Scenario: 仅保留白名单 EXIF

- **WHEN** 用户导入一张带 GPS、机身型号、序列号、镜头与曝光参数的照片
- **THEN** 发布主图只含拍摄时间、镜头与曝光白名单，不含 GPS、机身型号、序列号；缩略图不含 EXIF；`data/calendar.json` 不包含这些元数据字段

#### Scenario: 没有可保留的元数据

- **WHEN** 输入照片没有拍摄时间、镜头或曝光字段
- **THEN** 发布主图不写入空 EXIF 块，缩略图仍不包含 EXIF

#### Scenario: 不记录本地路径

- **WHEN** 用户从 `/home/user/Pictures/secret.jpg` 导入照片
- **THEN** `data/calendar.json` 只记录仓库内的相对资源路径，不记录原始绝对路径

### Requirement: 更新时间与缓存失效

`updatedAt` MUST 在每次条目内容变化时更新为不早于上一次的 UTC 时间；展示端 SHALL 将其作为 `data/calendar.json` 请求的缓存失效参数。仅重新生成未保存的草稿 MUST NOT 改变 `updatedAt`。

#### Scenario: 新增条目后更新时间前进

- **WHEN** 用户新增一个条目并保存
- **THEN** `updatedAt` 变为新的时间，展示端请求数据时带上新的版本参数

#### Scenario: 无变化时保持稳定

- **WHEN** 用户打开并关闭编辑器但没有保存任何修改
- **THEN** `updatedAt` 保持不变，线上缓存不会被无意义地击穿

### Requirement: 原子写入与可恢复性

写入 `data/calendar.json` 时 MUST 先写同目录临时文件，完成后再原子替换目标文件。任何时候被中断，磁盘上的 `calendar.json` MUST 要么是完整的旧版本，要么是完整的新版本，不得出现截断或半写入的 JSON。

#### Scenario: 写入过程中崩溃

- **WHEN** 编辑器在写入数据文件的过程中被强制终止
- **THEN** 重新启动后 `data/calendar.json` 仍是可解析的完整版本，临时文件不参与读取

#### Scenario: 校验失败不落盘

- **WHEN** 待写入的数据未通过单日唯一性或字段校验
- **THEN** 编辑器不替换现有文件，原数据保持不变

### Requirement: 版本兼容与演进

`version` MUST 为整数。读取方遇到大于自身支持主版本的 `version` 时 MUST 拒绝解析并给出「需要更新客户端」的提示；遇到缺少版本或非法版本时按无效数据处理。未来版本升级时 MUST 提供从旧版本到新版本的迁移步骤，不得静默丢弃旧条目。

#### Scenario: 未来版本数据

- **WHEN** 展示端读取到 `version: 2`，而自身只支持到 1
- **THEN** 展示端不猜测字段含义，按无照片状态降级并提示数据需要更新

#### Scenario: 旧版本数据迁移

- **WHEN** 编辑器打开一个旧主版本的数据文件
- **THEN** 按迁移规则升级到当前版本，保留所有可映射条目，并在写入前展示迁移结果

#### Scenario: 非法版本

- **WHEN** `version` 为字符串、负数或小数
- **THEN** 校验失败，不进行任何写入
