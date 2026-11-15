use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use url::Url;

use crate::error::{AppError, AppResult};
use crate::fsutil::{read_json, write_json};

#[derive(Debug, Clone)]
pub struct AppPaths {
    pub config_dir: PathBuf,
    pub data_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub local_site: PathBuf,
}

impl AppPaths {
    pub fn discover() -> AppResult<Self> {
        if let Ok(base) = env::var("PHOTO_CALENDAR_HOME") {
            let base = PathBuf::from(base);
            return Ok(Self::from_base(base));
        }
        let project = ProjectDirs::from("com", "photocalendar", "photo-calendar")
            .ok_or_else(|| AppError::new("CONFIG_INVALID", "无法确定应用配置目录"))?;
        let data_dir = project.data_dir().to_path_buf();
        Ok(Self {
            config_dir: project.config_dir().to_path_buf(),
            local_site: data_dir.join("site"),
            cache_dir: project.cache_dir().to_path_buf(),
            data_dir,
        })
    }

    pub fn from_base(base: PathBuf) -> Self {
        let data_dir = base.join("data");
        Self {
            config_dir: base.join("config"),
            local_site: data_dir.join("site"),
            cache_dir: base.join("cache"),
            data_dir,
        }
    }

    pub fn config_file(&self) -> PathBuf {
        self.config_dir.join("config.json")
    }

    pub fn ensure(&self) -> AppResult<()> {
        for dir in [
            &self.config_dir,
            &self.data_dir,
            &self.cache_dir,
            &self.local_site,
        ] {
            fs::create_dir_all(dir)?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeepSeekSettings {
    pub base_url: String,
    pub model: String,
}

impl Default for DeepSeekSettings {
    fn default() -> Self {
        Self {
            base_url: "https://api.deepseek.com".to_string(),
            model: "deepseek-flash".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitSettings {
    pub remote_url: String,
    pub branch: String,
    pub worktree_path: String,
    pub auto_publish: bool,
    pub site_url: String,
}

impl GitSettings {
    pub fn default_for(paths: &AppPaths) -> Self {
        Self {
            remote_url: String::new(),
            branch: "main".to_string(),
            worktree_path: paths.local_site.to_string_lossy().to_string(),
            auto_publish: true,
            site_url: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub version: u32,
    pub deepseek: DeepSeekSettings,
    pub git: GitSettings,
}

impl Settings {
    pub fn default_for(paths: &AppPaths) -> Self {
        Self {
            version: 1,
            deepseek: DeepSeekSettings::default(),
            git: GitSettings::default_for(paths),
        }
    }

    pub fn validate(&self) -> AppResult<()> {
        if self.version != 1 {
            return Err(AppError::new("CONFIG_INVALID", "配置版本不受支持"));
        }
        validate_http_url("DeepSeek API Base URL", &self.deepseek.base_url, false)?;
        if self.deepseek.model.trim().is_empty() {
            return Err(AppError::new("CONFIG_INVALID", "模型名不能为空"));
        }
        if !self.git.remote_url.trim().is_empty() {
            validate_remote_url(&self.git.remote_url)?;
        }
        validate_branch(&self.git.branch)?;
        if self.git.worktree_path.trim().is_empty() {
            return Err(AppError::new("CONFIG_INVALID", "工作副本路径不能为空"));
        }
        if !Path::new(&self.git.worktree_path).is_absolute() {
            return Err(AppError::new(
                "CONFIG_INVALID",
                "工作副本路径必须是绝对路径",
            ));
        }
        if !self.git.site_url.trim().is_empty() {
            validate_http_url("线上站点地址", &self.git.site_url, false)?;
        }
        Ok(())
    }
}

pub fn validate_http_url(label: &str, value: &str, allow_empty: bool) -> AppResult<()> {
    if value.trim().is_empty() {
        if allow_empty {
            return Ok(());
        }
        return Err(AppError::new("CONFIG_INVALID", format!("{label}不能为空")));
    }
    let parsed = Url::parse(value)?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(AppError::new(
            "CONFIG_INVALID",
            format!("{label}必须使用 http 或 https"),
        ));
    }
    Ok(())
}

pub fn validate_remote_url(value: &str) -> AppResult<()> {
    let value = value.trim();
    #[cfg(test)]
    if value.starts_with("file://") || Path::new(value).is_absolute() {
        return Ok(());
    }
    if value.starts_with("https://") || value.starts_with("http://") {
        let parsed = Url::parse(value)?;
        if !parsed.username().is_empty() || parsed.password().is_some() {
            return Err(AppError::new(
                "CONFIG_INVALID",
                "仓库地址不能包含明文用户名或令牌，请使用系统 Git 凭据",
            ));
        }
        if parsed.scheme() != "https" {
            return Err(AppError::new(
                "CONFIG_INVALID",
                "HTTPS 仓库地址必须使用 https://",
            ));
        }
        return Ok(());
    }
    if value.starts_with("ssh://") || value.starts_with("git@") {
        return Ok(());
    }
    Err(AppError::new(
        "CONFIG_INVALID",
        "请输入 HTTPS 或 SSH 形式的仓库地址",
    ))
}

pub fn validate_branch(value: &str) -> AppResult<()> {
    let branch = value.trim();
    if branch.is_empty()
        || branch.starts_with('-')
        || branch.starts_with('/')
        || branch.ends_with('/')
        || branch.ends_with(".lock")
        || branch.contains("..")
        || branch.contains("//")
        || branch.contains("@{")
        || branch.contains('~')
        || branch.contains('^')
        || branch.contains(':')
        || branch.contains('?')
        || branch.contains('*')
        || branch.contains('[')
        || branch.contains('\\')
        || branch.chars().any(char::is_whitespace)
    {
        return Err(AppError::new("CONFIG_INVALID", "分支名不合法"));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsLoad {
    pub settings: Settings,
    pub warning: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SettingsStore {
    pub paths: AppPaths,
}

impl SettingsStore {
    pub fn new(paths: AppPaths) -> Self {
        Self { paths }
    }

    pub fn load(&self) -> AppResult<SettingsLoad> {
        self.paths.ensure()?;
        let file = self.paths.config_file();
        if !file.exists() {
            return Ok(SettingsLoad {
                settings: Settings::default_for(&self.paths),
                warning: None,
            });
        }
        match read_json::<Settings>(&file) {
            Ok(Some(settings)) => match settings.validate() {
                Ok(()) => Ok(SettingsLoad {
                    settings,
                    warning: None,
                }),
                Err(error) => {
                    self.backup_corrupt()?;
                    Ok(SettingsLoad {
                        settings: Settings::default_for(&self.paths),
                        warning: Some(format!("配置文件无效：{}", error.message)),
                    })
                }
            },
            Ok(None) => Ok(SettingsLoad {
                settings: Settings::default_for(&self.paths),
                warning: None,
            }),
            Err(_) => {
                self.backup_corrupt()?;
                Ok(SettingsLoad {
                    settings: Settings::default_for(&self.paths),
                    warning: Some("配置文件损坏，已使用安全默认值".to_string()),
                })
            }
        }
    }

    pub fn save(&self, settings: &Settings) -> AppResult<()> {
        settings.validate()?;
        self.paths.ensure()?;
        write_json(&self.paths.config_file(), settings)
    }

    fn backup_corrupt(&self) -> AppResult<()> {
        let file = self.paths.config_file();
        if !file.exists() {
            return Ok(());
        }
        let stamp = Utc::now().format("%Y%m%d%H%M%S");
        let backup = self
            .paths
            .config_dir
            .join(format!("config.corrupt.{stamp}.json"));
        fs::rename(file, backup)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> (tempfile::TempDir, SettingsStore) {
        let dir = tempfile::tempdir().unwrap();
        let paths = AppPaths::from_base(dir.path().to_path_buf());
        (dir, SettingsStore::new(paths))
    }

    #[test]
    fn creates_defaults_and_round_trips() {
        let (_dir, store) = store();
        let loaded = store.load().unwrap();
        assert_eq!(loaded.settings.deepseek.model, "deepseek-flash");
        assert!(loaded.settings.git.auto_publish);
        store.save(&loaded.settings).unwrap();
        let again = store.load().unwrap();
        assert_eq!(again.settings, loaded.settings);
    }

    #[test]
    fn backs_up_corrupt_config() {
        let (dir, store) = store();
        store.paths.ensure().unwrap();
        fs::write(store.paths.config_file(), "{not json").unwrap();
        let loaded = store.load().unwrap();
        assert!(loaded.warning.is_some());
        let backups: Vec<_> = fs::read_dir(dir.path().join("config"))
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains("corrupt"))
            .collect();
        assert_eq!(backups.len(), 1);
    }

    #[test]
    fn rejects_invalid_values() {
        let (_dir, store) = store();
        let mut settings = store.load().unwrap().settings;
        settings.deepseek.base_url = "not-a-url".to_string();
        assert!(store.save(&settings).is_err());
        settings.deepseek.base_url = "https://api.deepseek.com".to_string();
        settings.git.branch = "bad branch".to_string();
        assert!(store.save(&settings).is_err());
        settings.git.branch = "main".to_string();
        settings.git.remote_url = "https://user:token@example.com/repo.git".to_string();
        assert!(store.save(&settings).is_err());
    }

    #[test]
    fn rejects_relative_worktree() {
        let (_dir, store) = store();
        let mut settings = store.load().unwrap().settings;
        settings.git.worktree_path = "./site".to_string();
        assert!(store.save(&settings).is_err());
    }
}
