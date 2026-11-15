use std::sync::Mutex;

use keyring::Entry;
use serde::Serialize;

use crate::error::{AppError, AppResult};

pub const SERVICE: &str = "com.photocalendar.editor";
pub const ACCOUNT: &str = "deepseek";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretStatus {
    pub configured: bool,
    pub persistent: bool,
    pub masked: String,
    pub warning: Option<String>,
}

pub trait SecretBackend: Send + Sync {
    fn get(&self) -> AppResult<Option<String>>;
    fn set(&self, value: &str) -> AppResult<()>;
    fn clear(&self) -> AppResult<()>;
}

pub struct KeyringBackend;

impl SecretBackend for KeyringBackend {
    fn get(&self) -> AppResult<Option<String>> {
        let entry = Entry::new(SERVICE, ACCOUNT)?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    fn set(&self, value: &str) -> AppResult<()> {
        let entry = Entry::new(SERVICE, ACCOUNT)?;
        entry.set_password(value)?;
        Ok(())
    }

    fn clear(&self) -> AppResult<()> {
        let entry = Entry::new(SERVICE, ACCOUNT)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.into()),
        }
    }
}

pub struct SecretManager {
    backend: Box<dyn SecretBackend>,
    session: Mutex<Option<String>>,
    warning: Mutex<Option<String>>,
}

impl SecretManager {
    pub fn system() -> Self {
        Self::new(Box::new(KeyringBackend))
    }

    pub fn new(backend: Box<dyn SecretBackend>) -> Self {
        Self {
            backend,
            session: Mutex::new(None),
            warning: Mutex::new(None),
        }
    }

    pub fn get_key(&self) -> AppResult<String> {
        if let Ok(Some(value)) = self.backend.get() {
            return Ok(value);
        }
        if let Some(value) = self.session.lock().unwrap().clone() {
            return Ok(value);
        }
        Err(AppError::new("SECRET_MISSING", "尚未配置 DeepSeek API Key"))
    }

    pub fn set_key(&self, value: &str) -> AppResult<SecretStatus> {
        let value = value.trim();
        if value.is_empty() {
            return Err(AppError::new("CONFIG_INVALID", "API Key 不能为空"));
        }
        let warning = match self.backend.set(value) {
            Ok(()) => {
                *self.session.lock().unwrap() = None;
                None
            }
            Err(error) => {
                *self.session.lock().unwrap() = Some(value.to_string());
                Some(format!(
                    "系统钥匙串不可用，密钥仅保存在本次会话中：{}",
                    error.message
                ))
            }
        };
        *self.warning.lock().unwrap() = warning;
        Ok(self.status())
    }

    pub fn clear(&self) -> AppResult<SecretStatus> {
        let mut warning = None;
        if let Err(error) = self.backend.clear() {
            warning = Some(format!("清除系统钥匙串失败：{}", error.message));
        }
        *self.session.lock().unwrap() = None;
        *self.warning.lock().unwrap() = warning;
        Ok(self.status())
    }

    pub fn status(&self) -> SecretStatus {
        let mut warning = self.warning.lock().unwrap().clone();
        let (mut value, persistent) = match self.backend.get() {
            Ok(found) => {
                let present = found.is_some();
                (found, present)
            }
            Err(error) => {
                if warning.is_none() {
                    warning = Some(format!("系统钥匙串不可用：{}", error.message));
                }
                (self.session.lock().unwrap().clone(), false)
            }
        };
        if value.is_none() {
            value = self.session.lock().unwrap().clone();
        }
        let configured = value.is_some();
        let masked = value.as_deref().map(mask_key).unwrap_or_default();
        SecretStatus {
            configured,
            persistent: persistent && configured,
            masked,
            warning,
        }
    }
}

fn mask_key(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= 4 {
        return "••••".to_string();
    }
    let tail: String = chars[chars.len() - 4..].iter().collect();
    format!("••••••••{tail}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    struct MemoryBackend {
        value: Mutex<Option<String>>,
        fail: bool,
    }

    impl SecretBackend for MemoryBackend {
        fn get(&self) -> AppResult<Option<String>> {
            if self.fail {
                return Err(AppError::new("KEYCHAIN_UNAVAILABLE", "no keychain"));
            }
            Ok(self.value.lock().unwrap().clone())
        }
        fn set(&self, value: &str) -> AppResult<()> {
            if self.fail {
                return Err(AppError::new("KEYCHAIN_UNAVAILABLE", "no keychain"));
            }
            *self.value.lock().unwrap() = Some(value.to_string());
            Ok(())
        }
        fn clear(&self) -> AppResult<()> {
            *self.value.lock().unwrap() = None;
            Ok(())
        }
    }

    #[test]
    fn stores_and_masks_secret() {
        let manager = SecretManager::new(Box::new(MemoryBackend {
            value: Mutex::new(None),
            fail: false,
        }));
        assert!(!manager.status().configured);
        manager.set_key("sk-12345678").unwrap();
        let status = manager.status();
        assert!(status.configured);
        assert!(status.persistent);
        assert_eq!(status.masked, "••••••••5678");
        assert_eq!(manager.get_key().unwrap(), "sk-12345678");
        manager.clear().unwrap();
        assert!(!manager.status().configured);
    }

    #[test]
    fn falls_back_to_session_when_keychain_unavailable() {
        let manager = SecretManager::new(Box::new(MemoryBackend {
            value: Mutex::new(None),
            fail: true,
        }));
        let status = manager.set_key("sk-session").unwrap();
        assert!(status.configured);
        assert!(!status.persistent);
        assert!(status.warning.is_some());
        assert_eq!(manager.get_key().unwrap(), "sk-session");
    }
}
