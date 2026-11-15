use std::time::Duration;

use chrono::Utc;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;
use unicode_normalization::UnicodeNormalization;

use crate::error::{AppError, AppResult};

pub const PROMPT_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionCandidate {
    pub caption: String,
    pub model: String,
    pub prompt_version: u32,
    pub generated_at: String,
}

pub struct DeepSeekClient {
    http: Client,
    base_url: String,
    model: String,
    api_key: String,
}

impl DeepSeekClient {
    pub fn new(base_url: String, model: String, api_key: String) -> AppResult<Self> {
        let http = Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(AppError::from)?;
        Ok(Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            model,
            api_key,
        })
    }

    fn endpoint(&self) -> String {
        format!("{}/chat/completions", self.base_url)
    }

    pub async fn test_connection(&self) -> AppResult<String> {
        let body = json!({
            "model": self.model,
            "messages": [{ "role": "user", "content": "ping" }],
            "max_tokens": 1,
            "stream": false
        });
        let response = self
            .http
            .post(self.endpoint())
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await?;
        if response.status().is_success() {
            Ok(self.model.clone())
        } else {
            Err(status_error(response).await)
        }
    }

    pub async fn generate(
        &self,
        image_data_url: &str,
        date: &str,
        facts: &str,
        previous: Option<&str>,
    ) -> AppResult<CaptionCandidate> {
        let mut attempts = 0;
        let mut last_reason = String::from("模型没有返回合规文案");
        while attempts < 3 {
            attempts += 1;
            let candidate = self
                .request_once(image_data_url, date, facts, previous)
                .await?;
            match clean_caption(&candidate) {
                Ok(cleaned) => {
                    if let Some(previous) = previous {
                        if normalize_for_compare(&cleaned) == normalize_for_compare(previous) {
                            last_reason = "生成的文案与上一版重复".to_string();
                            continue;
                        }
                    }
                    return Ok(CaptionCandidate {
                        caption: cleaned,
                        model: self.model.clone(),
                        prompt_version: PROMPT_VERSION,
                        generated_at: Utc::now().to_rfc3339(),
                    });
                }
                Err(error) => {
                    last_reason = error.message;
                }
            }
        }
        if last_reason.contains("重复") {
            Err(AppError::new("CAPTION_DUPLICATE", last_reason))
        } else {
            Err(AppError::new("CAPTION_INVALID", last_reason))
        }
    }

    async fn request_once(
        &self,
        image_data_url: &str,
        date: &str,
        facts: &str,
        previous: Option<&str>,
    ) -> AppResult<String> {
        let previous_instruction = previous
            .map(|value| {
                format!(
                    "上一版文案是：{value}\n这一次必须换一个角度，不能与上一版相同（标点差异也算相同）。"
                )
            })
            .unwrap_or_default();
        let user_text = format!(
            "目标日期：{date}\n日期特征：{facts}\n{previous_instruction}\n请为这张照片写一句文案。"
        );
        let body = json!({
            "model": self.model,
            "messages": [
                { "role": "system", "content": SYSTEM_PROMPT },
                { "role": "user", "content": [
                    { "type": "text", "text": user_text },
                    { "type": "image_url", "image_url": { "url": image_data_url, "detail": "high" } }
                ]}
            ],
            "temperature": 1.0,
            "max_tokens": 300,
            "stream": false
        });
        let response = self
            .http
            .post(self.endpoint())
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await?;
        if !response.status().is_success() {
            return Err(status_error(response).await);
        }
        let payload: ChatResponse = response.json().await.map_err(|error| {
            AppError::new(
                "DEEPSEEK_INVALID_RESPONSE",
                format!("DeepSeek 返回无法解析：{error}"),
            )
        })?;
        let choice = payload.choices.first().ok_or_else(|| {
            AppError::new("DEEPSEEK_INVALID_RESPONSE", "DeepSeek 没有返回候选文案")
        })?;
        if choice.finish_reason.as_deref() == Some("content_filter") {
            return Err(AppError::new(
                "DEEPSEEK_REFUSED",
                "图片或提示未能通过内容安全策略",
            ));
        }
        choice
            .message
            .content
            .clone()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| AppError::new("DEEPSEEK_INVALID_RESPONSE", "DeepSeek 返回了空内容"))
    }
}

const SYSTEM_PROMPT: &str = r#"你是「照片日历」的中文文案写作者。请只输出一句或两句话，不要解释、不要标题、不要 Markdown、不要引号包裹。

要求：
1. 15 到 120 个汉字，通常一至两句；
2. 必须包含至少一个从照片画面中可辨认的具体元素，不能写成可套用于任何照片的通用祝福；
3. 语气感性、有巧思，带一点引导人出门探索世界的意味，让人感到世界值得一看；
4. 如果日期特征里有可靠的节日或节气，可以自然呼应；不可靠时不要编造；
5. 可以引用诗句或名言，但作者、出处和原文必须准确；不确定就不要引用；
6. 文案必须与上一版不同（去除空白和标点后比较）。"#;

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Message {
    content: Option<String>,
}

async fn status_error(response: reqwest::Response) -> AppError {
    let status = response.status();
    let retry_after = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let body = response.text().await.unwrap_or_default();
    let detail = safe_error_detail(&body);
    match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            AppError::new("DEEPSEEK_AUTH", "DeepSeek API Key 无效或无权限").with_details(detail)
        }
        StatusCode::PAYMENT_REQUIRED => {
            AppError::new("DEEPSEEK_QUOTA", "DeepSeek 账户余额不足").with_details(detail)
        }
        StatusCode::TOO_MANY_REQUESTS => {
            let wait = retry_after
                .map(|value| format!("，建议等待 {value} 秒"))
                .unwrap_or_default();
            AppError::new(
                "DEEPSEEK_RATE_LIMIT",
                format!("DeepSeek 请求过于频繁{wait}"),
            )
            .with_details(detail)
        }
        status if status.is_server_error() => {
            AppError::new("DEEPSEEK_SERVER", "DeepSeek 服务暂时不可用").with_details(detail)
        }
        StatusCode::BAD_REQUEST => {
            AppError::new("DEEPSEEK_INVALID_RESPONSE", "DeepSeek 请求参数或模型无效")
                .with_details(detail)
        }
        _ => AppError::new(
            "DEEPSEEK_INVALID_RESPONSE",
            format!("DeepSeek 返回 HTTP {status}"),
        )
        .with_details(detail),
    }
}

fn safe_error_detail(body: &str) -> String {
    let trimmed: String = body.chars().take(500).collect();
    trimmed.replace("sk-", "sk-***")
}

pub fn clean_caption(raw: &str) -> AppResult<String> {
    let mut value = raw.trim().to_string();
    if value.starts_with("```") {
        value = value
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
            .to_string();
    }
    value = value
        .trim_matches(|ch| matches!(ch, '"' | '\'' | '“' | '”' | '‘' | '’'))
        .trim()
        .to_string();
    if value.is_empty() {
        return Err(AppError::new("CAPTION_INVALID", "模型返回空文案"));
    }
    if value.contains('\n') || value.contains("```") || value.starts_with('#') {
        return Err(AppError::new(
            "CAPTION_INVALID",
            "模型返回了多段或 Markdown 内容",
        ));
    }
    let length = value.chars().count();
    if !(15..=120).contains(&length) {
        return Err(AppError::new(
            "CAPTION_INVALID",
            format!("文案长度 {length} 不在 15–120 之间"),
        ));
    }
    let chinese = value
        .chars()
        .filter(|ch| ('\u{4e00}'..='\u{9fff}').contains(ch))
        .count();
    if chinese * 2 < length {
        return Err(AppError::new("CAPTION_INVALID", "模型返回的文案不是中文"));
    }
    Ok(value)
}

pub fn normalize_for_compare(value: &str) -> String {
    value
        .nfkc()
        .collect::<String>()
        .chars()
        .filter(|ch| {
            !ch.is_whitespace()
                && !ch.is_ascii_punctuation()
                && !"，。！？；：、‘’“”（）【】《》…—·～".contains(*ch)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleans_and_validates_captions() {
        assert_eq!(
            clean_caption("“风把下午吹得很慢，连影子都愿意多留一会儿。”").unwrap(),
            "风把下午吹得很慢，连影子都愿意多留一会儿。"
        );
        assert!(clean_caption("太短").is_err());
        assert!(clean_caption("# 标题\n正文").is_err());
        assert!(clean_caption("这是一段完全由 English words 组成的 caption 内容").is_err());
    }

    #[test]
    fn normalizes_only_punctuation_differences() {
        assert_eq!(
            normalize_for_compare("“风把下午吹得很慢。”"),
            normalize_for_compare("风把下午吹得很慢")
        );
    }

    #[test]
    fn prompt_uses_previous_caption() {
        assert!(SYSTEM_PROMPT.contains("上一版"));
        assert!(SYSTEM_PROMPT.contains("15 到 120"));
    }
}

#[cfg(test)]
mod http_tests {
    use super::*;
    use serde_json::json;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, Respond, ResponseTemplate};

    struct SequenceResponder {
        index: Arc<AtomicUsize>,
        captions: Vec<&'static str>,
    }

    impl Respond for SequenceResponder {
        fn respond(&self, _request: &wiremock::Request) -> ResponseTemplate {
            let index = self.index.fetch_add(1, Ordering::SeqCst);
            let caption = self.captions[index.min(self.captions.len() - 1)];
            ResponseTemplate::new(200).set_body_json(json!({
                "choices": [{ "message": { "content": caption }, "finish_reason": "stop" }]
            }))
        }
    }

    async fn client(server: &MockServer) -> DeepSeekClient {
        DeepSeekClient::new(
            server.uri(),
            "deepseek-flash".to_string(),
            "sk-test".to_string(),
        )
        .unwrap()
    }

    #[tokio::test]
    async fn generates_a_caption() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/chat/completions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "choices": [{ "message": { "content": "风把下午吹得很慢，连影子都愿意多留一会儿。" }, "finish_reason": "stop" }]
            })))
            .mount(&server)
            .await;
        let result = client(&server)
            .await
            .generate("data:image/jpeg;base64,AA==", "2026-11-08", "元旦", None)
            .await
            .unwrap();
        assert_eq!(result.caption, "风把下午吹得很慢，连影子都愿意多留一会儿。");
        assert_eq!(result.model, "deepseek-flash");
    }

    #[tokio::test]
    async fn retries_a_duplicate_and_then_accepts_a_new_caption() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/chat/completions"))
            .respond_with(SequenceResponder {
                index: Arc::new(AtomicUsize::new(0)),
                captions: vec![
                    "风把下午吹得很慢，连影子都愿意多留一会儿。",
                    "风把下午吹得很慢，连影子都愿意多留一会儿。",
                    "光落在旧墙上，像一封没有署名的邀请函。",
                ],
            })
            .mount(&server)
            .await;
        let result = client(&server)
            .await
            .generate(
                "data:image/jpeg;base64,AA==",
                "2026-11-08",
                "",
                Some("风把下午吹得很慢，连影子都愿意多留一会儿"),
            )
            .await
            .unwrap();
        assert!(result.caption.contains("旧墙"));
    }

    #[tokio::test]
    async fn reports_duplicate_after_three_attempts() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/chat/completions"))
            .respond_with(SequenceResponder {
                index: Arc::new(AtomicUsize::new(0)),
                captions: vec!["风把下午吹得很慢，连影子都愿意多留一会儿。"],
            })
            .mount(&server)
            .await;
        let error = client(&server)
            .await
            .generate(
                "data:image/jpeg;base64,AA==",
                "2026-11-08",
                "",
                Some("风把下午吹得很慢，连影子都愿意多留一会儿"),
            )
            .await
            .unwrap_err();
        assert_eq!(error.code, "CAPTION_DUPLICATE");
    }

    #[tokio::test]
    async fn maps_auth_and_rate_limit_errors() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/chat/completions"))
            .respond_with(ResponseTemplate::new(401).set_body_string("nope"))
            .mount(&server)
            .await;
        let error = client(&server)
            .await
            .generate("data:image/jpeg;base64,AA==", "2026-11-08", "", None)
            .await
            .unwrap_err();
        assert_eq!(error.code, "DEEPSEEK_AUTH");

        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/chat/completions"))
            .respond_with(
                ResponseTemplate::new(429)
                    .insert_header("retry-after", "7")
                    .set_body_string("slow down"),
            )
            .mount(&server)
            .await;
        let error = client(&server)
            .await
            .generate("data:image/jpeg;base64,AA==", "2026-11-08", "", None)
            .await
            .unwrap_err();
        assert_eq!(error.code, "DEEPSEEK_RATE_LIMIT");
        assert!(error.message.contains('7'));
    }

    #[tokio::test]
    async fn tests_connection_without_vision() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/chat/completions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "choices": [{ "message": { "content": "ok" }, "finish_reason": "stop" }]
            })))
            .mount(&server)
            .await;
        assert_eq!(
            client(&server).await.test_connection().await.unwrap(),
            "deepseek-flash"
        );
    }
}
