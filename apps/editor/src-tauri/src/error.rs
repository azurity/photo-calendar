use serde::Serialize;
use std::fmt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

pub type AppResult<T> = Result<T, AppError>;

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::new("IO_ERROR", error.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::new("DATA_INVALID", format!("JSON 解析失败：{error}"))
    }
}

impl From<image::ImageError> for AppError {
    fn from(error: image::ImageError) -> Self {
        Self::new("IMAGE_INVALID", format!("图片无法处理：{error}"))
    }
}

impl From<exif::Error> for AppError {
    fn from(error: exif::Error) -> Self {
        Self::new("IMAGE_INVALID", format!("EXIF 无法读取：{error}"))
    }
}

impl From<reqwest::Error> for AppError {
    fn from(error: reqwest::Error) -> Self {
        if error.is_timeout() {
            Self::new("DEEPSEEK_TIMEOUT", "请求 DeepSeek 超时，请稍后重试")
        } else if error.is_connect() {
            Self::new("DEEPSEEK_NETWORK", "无法连接 DeepSeek，请检查网络")
        } else {
            Self::new("DEEPSEEK_NETWORK", error.to_string())
        }
    }
}

impl From<keyring::Error> for AppError {
    fn from(error: keyring::Error) -> Self {
        Self::new("KEYCHAIN_UNAVAILABLE", error.to_string())
    }
}

impl From<url::ParseError> for AppError {
    fn from(error: url::ParseError) -> Self {
        Self::new("CONFIG_INVALID", format!("URL 无效：{error}"))
    }
}

impl From<chrono::ParseError> for AppError {
    fn from(error: chrono::ParseError) -> Self {
        Self::new("DATA_INVALID", format!("时间格式无效：{error}"))
    }
}
