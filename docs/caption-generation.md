# DeepSeek 文案生成

## 模型与请求

- 默认模型：`deepseek-flash`（支持图片输入）。
- 接口：`POST {baseUrl}/chat/completions`，OpenAI 兼容 Chat Completions 多模态格式。
- 图片：临时生成 1568 长边、质量 80、完全去元数据的 JPEG；体积 ≤ 2 MiB；`detail: high`。
- 请求不包含本地路径、GPS、设备序列号或发布主图保留的时间/镜头/曝光 EXIF。

## 提示词

系统提示固定为「照片日历文案写作者」，版本 `caption-prompt-v1`，约束：

- 中文，1–2 句，15–120 个汉字；
- 至少包含一个画面中可辨认的具体元素；
- 感性、有巧思、引导探索世界；
- 有可靠日期特征时可自然呼应节日/节气，不编造；
- 引用诗句/名言必须准确，不确定则不用；
- 刷新的候选必须与上一版不同（去空白和标点后比较）。

日期特征由前端 `lunar-javascript` 计算，包括公历固定/浮动节日、农历节日与二十四节气；超出 1900–2100 或计算异常时标记「无已知日期特征」。日期特征只依赖目标日期，不读取请求时的时间。

## 刷新与校验

- 结果清洗：去首尾空白、包裹引号、代码围栏；拒绝空、多段、Markdown、非中文、长度不合规。
- 与上一版做 NFKC + 去空白/标点比较；相同则自动重试，最多共 3 次。
- 三次仍重复返回 `CAPTION_DUPLICATE`，保留旧文案；其他校验失败返回 `CAPTION_INVALID`。
- 历史更早版本不参与比较，只要求与紧邻的上一版不同。

## 错误码

| 错误码 | 含义 | 处理 |
| --- | --- | --- |
| `SECRET_MISSING` | 未配置 API Key | 跳转设置 |
| `DEEPSEEK_AUTH` | 401/403 | 检查 Key/权限 |
| `DEEPSEEK_QUOTA` | 402 | 检查余额 |
| `DEEPSEEK_RATE_LIMIT` | 429 | 展示 `Retry-After`，稍后重试 |
| `DEEPSEEK_TIMEOUT` | 请求超时 | 稍后重试 |
| `DEEPSEEK_NETWORK` | 网络不可达 | 检查网络 |
| `DEEPSEEK_REFUSED` | 内容安全拒绝 | 不循环重试同一图片 |
| `DEEPSEEK_SERVER` | 5xx | 稍后重试 |
| `CAPTION_INVALID` | 返回不合规 | 保留旧文案，可重试 |
| `CAPTION_DUPLICATE` | 三次都与上一版重复 | 保留旧文案，稍后再换一句 |

失败时不写入半成品，不使用固定模板替代。

## 生成元数据与手动文案

保存生成结果时在条目中记录 `captionModel`、`captionPromptVersion`、`captionUpdatedAt`。手动编辑会把 `captionSource` 标记为 `manual`；再次生成/刷新前界面会提示将覆盖手动内容。重新打开或保存其他条目不会自动改写手动文案。

## 费用与隐私

图片按 DeepSeek 视觉 token 计费，单张有上限；文案很短。API Key 只用于请求头，不进入日志或界面可复制的诊断信息。发送图不含任何 EXIF 与本地路径。
