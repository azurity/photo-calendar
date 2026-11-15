use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Duration, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::fsutil::{atomic_write, ensure_inside};

pub const CURRENT_VERSION: u32 = 1;
pub const MAX_CAPTION_CHARS: usize = 120;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub date: String,
    pub photo: String,
    pub thumbnail: String,
    pub caption: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption_prompt_version: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption_updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub captured_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub version: u32,
    pub updated_at: String,
    pub entries: Vec<Entry>,
}

impl Manifest {
    pub fn empty() -> Self {
        Self {
            version: CURRENT_VERSION,
            updated_at: now_iso(),
            entries: Vec::new(),
        }
    }

    pub fn data_dir(root: &Path) -> PathBuf {
        root.join("data")
    }

    pub fn file(root: &Path) -> PathBuf {
        Self::data_dir(root).join("calendar.json")
    }

    pub fn load(root: &Path) -> AppResult<Self> {
        let path = Self::file(root);
        if !path.exists() {
            return Ok(Self::empty());
        }
        let raw = fs::read(&path)?;
        let value: serde_json::Value = serde_json::from_slice(&raw)?;
        migrate_manifest(value)
    }

    pub fn save(&mut self, root: &Path) -> AppResult<()> {
        let previous = Self::load(root).ok();
        let previous_updated = previous
            .as_ref()
            .and_then(|manifest| DateTime::parse_from_rfc3339(&manifest.updated_at).ok())
            .map(|value| value.with_timezone(&Utc));
        let now = Utc::now();
        let next = match previous_updated {
            Some(previous) if now.timestamp() <= previous.timestamp() => {
                previous + Duration::seconds(1)
            }
            _ => now,
        };
        self.updated_at = next.to_rfc3339_opts(SecondsFormat::Secs, true);
        self.validate_with_root(Some(root), true)?;
        let bytes = serde_json::to_vec_pretty(self)?;
        atomic_write(&Self::file(root), &bytes)
    }

    pub fn validate(&self) -> AppResult<()> {
        self.validate_with_root(None, false)
    }

    pub fn validate_with_root(&self, root: Option<&Path>, check_files: bool) -> AppResult<()> {
        if self.version != CURRENT_VERSION {
            return Err(AppError::new(
                "DATA_INVALID",
                format!(
                    "数据版本 {} 高于当前支持的版本 {}，请更新客户端",
                    self.version, CURRENT_VERSION
                ),
            ));
        }
        parse_utc("updatedAt", &self.updated_at)?;
        let mut dates = HashSet::new();
        let mut photos = HashSet::new();
        let mut thumbnails = HashSet::new();
        for entry in &self.entries {
            validate_entry(entry)?;
            if !dates.insert(entry.date.clone()) {
                return Err(AppError::new(
                    "DATA_INVALID",
                    format!("日期重复：{}", entry.date),
                ));
            }
            if !photos.insert(entry.photo.clone()) {
                return Err(AppError::new(
                    "DATA_INVALID",
                    format!("主图被重复引用：{}", entry.photo),
                ));
            }
            if !thumbnails.insert(entry.thumbnail.clone()) {
                return Err(AppError::new(
                    "DATA_INVALID",
                    format!("缩略图被重复引用：{}", entry.thumbnail),
                ));
            }
            if check_files {
                if let Some(root) = root {
                    let photo = ensure_inside(root, &entry.photo)?;
                    let thumbnail = ensure_inside(root, &entry.thumbnail)?;
                    if !photo.is_file() {
                        return Err(AppError::new(
                            "DATA_INVALID",
                            format!("缺少主图：{}", entry.photo),
                        ));
                    }
                    if !thumbnail.is_file() {
                        return Err(AppError::new(
                            "DATA_INVALID",
                            format!("缺少缩略图：{}", entry.thumbnail),
                        ));
                    }
                }
            }
        }
        Ok(())
    }

    pub fn sorted_entries(&self) -> Vec<Entry> {
        let mut entries = self.entries.clone();
        entries.sort_by(|a, b| b.date.cmp(&a.date));
        entries
    }
}

/// A single place where future schema versions enter the editor. Version 1 is
/// currently the only supported on-disk shape; older/newer versions are
/// rejected rather than guessed.
pub fn migrate_manifest(value: serde_json::Value) -> AppResult<Manifest> {
    let version = value
        .get("version")
        .and_then(|version| version.as_u64())
        .ok_or_else(|| AppError::new("DATA_INVALID", "数据缺少有效的 version 字段"))?;
    if version > u64::from(CURRENT_VERSION) {
        return Err(AppError::new(
            "DATA_INVALID",
            format!("数据版本 {version} 高于当前支持的版本 {CURRENT_VERSION}，请更新客户端"),
        ));
    }
    if version != u64::from(CURRENT_VERSION) {
        return Err(AppError::new(
            "DATA_INVALID",
            format!("数据版本 {version} 暂不支持迁移"),
        ));
    }
    let manifest: Manifest = serde_json::from_value(value)?;
    manifest.validate()?;
    Ok(manifest)
}

pub fn validate_entry(entry: &Entry) -> AppResult<()> {
    let date = chrono::NaiveDate::parse_from_str(&entry.date, "%Y-%m-%d")
        .map_err(|_| AppError::new("DATA_INVALID", format!("日期无效：{}", entry.date)))?;
    validate_photo_path(&entry.photo)?;
    validate_thumbnail_path(&entry.thumbnail)?;
    if entry.photo == entry.thumbnail {
        return Err(AppError::new("DATA_INVALID", "主图与缩略图不能相同"));
    }
    validate_caption(&entry.caption)?;
    parse_utc("createdAt", &entry.created_at)?;
    parse_utc("updatedAt", &entry.updated_at)?;
    if let Some(captured) = &entry.captured_at {
        let parsed = DateTime::parse_from_rfc3339(captured)
            .map_err(|_| AppError::new("DATA_INVALID", format!("拍摄时间无效：{captured}")))?;
        if parsed.date_naive() != date {
            return Err(AppError::new(
                "DATA_INVALID",
                "拍摄时间的当地日期必须与条目日期一致",
            ));
        }
    }
    if let Some(source) = &entry.caption_source {
        if source != "generated" && source != "manual" {
            return Err(AppError::new("DATA_INVALID", "captionSource 无效"));
        }
    }
    if let Some(value) = &entry.caption_updated_at {
        parse_utc("captionUpdatedAt", value)?;
    }
    Ok(())
}

pub fn validate_caption(caption: &str) -> AppResult<()> {
    let trimmed = caption.trim();
    if trimmed.is_empty() {
        return Err(AppError::new("DATA_INVALID", "文案不能为空"));
    }
    let length = trimmed.chars().count();
    if length > MAX_CAPTION_CHARS {
        return Err(AppError::new(
            "DATA_INVALID",
            format!("文案不能超过 {MAX_CAPTION_CHARS} 个字符"),
        ));
    }
    if caption.chars().any(|ch| ch.is_control()) {
        return Err(AppError::new("DATA_INVALID", "文案不能包含控制字符或换行"));
    }
    if caption.contains('<') && caption.contains('>') {
        return Err(AppError::new("DATA_INVALID", "文案不能包含 HTML 标签"));
    }
    if caption.trim_start().starts_with('#') || caption.contains("```") {
        return Err(AppError::new("DATA_INVALID", "文案不能包含 Markdown 结构"));
    }
    Ok(())
}

fn validate_photo_path(value: &str) -> AppResult<()> {
    if !value.starts_with("data/photos/") || value.starts_with("data/photos/thumbs/") {
        return Err(AppError::new(
            "DATA_INVALID",
            format!("主图路径必须位于 data/photos/ 下：{value}"),
        ));
    }
    validate_relative(value)
}

fn validate_thumbnail_path(value: &str) -> AppResult<()> {
    if !value.starts_with("data/photos/thumbs/") {
        return Err(AppError::new(
            "DATA_INVALID",
            format!("缩略图路径必须位于 data/photos/thumbs/ 下：{value}"),
        ));
    }
    validate_relative(value)
}

fn validate_relative(value: &str) -> AppResult<()> {
    if value.starts_with('/')
        || value.contains('\\')
        || value.contains('\0')
        || value.split('/').any(|part| part == ".." || part == ".")
    {
        return Err(AppError::new(
            "DATA_INVALID",
            format!("资源路径越界：{value}"),
        ));
    }
    Ok(())
}

pub fn parse_utc(label: &str, value: &str) -> AppResult<DateTime<Utc>> {
    if !value.ends_with('Z') {
        return Err(AppError::new(
            "DATA_INVALID",
            format!("{label} 必须是 UTC 时间"),
        ));
    }
    Ok(DateTime::parse_from_rfc3339(value)
        .map_err(|_| AppError::new("DATA_INVALID", format!("{label} 时间格式无效")))?
        .with_timezone(&Utc))
}

pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub fn cleanup_orphans(root: &Path, manifest: &Manifest) -> AppResult<Vec<String>> {
    let referenced: HashSet<&str> = manifest
        .entries
        .iter()
        .flat_map(|entry| [entry.photo.as_str(), entry.thumbnail.as_str()])
        .collect();
    let pattern = regex::Regex::new(r"^\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.(webp|jpg)$").unwrap();
    let mut removed = Vec::new();
    for directory in ["data/photos", "data/photos/thumbs"] {
        let dir = root.join(directory);
        if !dir.is_dir() {
            continue;
        }
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            if !entry.file_type()?.is_file() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if !pattern.is_match(&name) {
                continue;
            }
            let relative = format!("{directory}/{name}");
            if !referenced.contains(relative.as_str()) {
                fs::remove_file(entry.path())?;
                removed.push(relative);
            }
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(date: &str) -> Entry {
        Entry {
            date: date.to_string(),
            photo: format!("data/photos/{date}-a1b2c3d4.webp"),
            thumbnail: format!("data/photos/thumbs/{date}-a1b2c3d4.webp"),
            caption: "风把下午吹得很慢。".to_string(),
            caption_source: Some("generated".to_string()),
            caption_model: Some("deepseek-flash".to_string()),
            caption_prompt_version: Some(1),
            caption_updated_at: Some("2026-11-15T09:55:00Z".to_string()),
            captured_at: Some("2026-11-08T17:30:00+08:00".to_string()),
            created_at: "2026-11-15T09:50:00Z".to_string(),
            updated_at: "2026-11-15T09:55:00Z".to_string(),
        }
    }

    #[test]
    fn accepts_valid_manifest() {
        let manifest = Manifest {
            version: 1,
            updated_at: "2026-11-15T10:00:00Z".to_string(),
            entries: vec![entry("2026-11-08")],
        };
        assert!(manifest.validate().is_ok());
    }

    #[test]
    fn rejects_duplicates_bad_dates_paths_and_captions() {
        let mut manifest = Manifest {
            version: 1,
            updated_at: "2026-11-15T10:00:00Z".to_string(),
            entries: vec![entry("2026-11-08"), entry("2026-11-08")],
        };
        assert!(manifest.validate().is_err());

        manifest.entries = vec![entry("2026-02-30")];
        assert!(manifest.validate().is_err());

        manifest.entries = vec![entry("2026-11-08")];
        manifest.entries[0].photo = "../../secrets.png".to_string();
        assert!(manifest.validate().is_err());

        manifest.entries = vec![entry("2026-11-08")];
        manifest.entries[0].caption = "".to_string();
        assert!(manifest.validate().is_err());

        manifest.entries = vec![entry("2026-11-08")];
        manifest.entries[0].caption = "<script>alert(1)</script>".to_string();
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn migration_entrypoint_accepts_v1_and_rejects_unknown_versions() {
        let v1 = serde_json::json!({
            "version": 1,
            "updatedAt": "2026-11-15T10:00:00Z",
            "entries": []
        });
        assert!(migrate_manifest(v1).is_ok());
        let v2 = serde_json::json!({
            "version": 2,
            "updatedAt": "2026-11-15T10:00:00Z",
            "entries": []
        });
        assert_eq!(migrate_manifest(v2).unwrap_err().code, "DATA_INVALID");
        let missing = serde_json::json!({ "updatedAt": "2026-11-15T10:00:00Z", "entries": [] });
        assert_eq!(migrate_manifest(missing).unwrap_err().code, "DATA_INVALID");
    }

    #[test]
    fn rejects_future_versions_and_captured_date_mismatch() {
        let mut manifest = Manifest {
            version: 2,
            updated_at: "2026-11-15T10:00:00Z".to_string(),
            entries: vec![],
        };
        assert!(manifest.validate().is_err());
        manifest.version = 1;
        manifest.entries = vec![entry("2026-11-08")];
        manifest.entries[0].captured_at = Some("2026-11-09T01:00:00+08:00".to_string());
        assert!(manifest.validate().is_err());
    }

    #[test]
    fn writes_atomically_and_advances_updated_at() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("data/photos/thumbs")).unwrap();
        fs::write(
            dir.path().join("data/photos/2026-11-08-a1b2c3d4.webp"),
            b"x",
        )
        .unwrap();
        fs::write(
            dir.path()
                .join("data/photos/thumbs/2026-11-08-a1b2c3d4.webp"),
            b"x",
        )
        .unwrap();
        let mut manifest = Manifest::empty();
        manifest.entries = vec![entry("2026-11-08")];
        manifest.save(dir.path()).unwrap();
        let first = Manifest::load(dir.path()).unwrap();
        let mut second = first.clone();
        second.entries.clear();
        second.save(dir.path()).unwrap();
        let stored = Manifest::load(dir.path()).unwrap();
        assert!(stored.updated_at > first.updated_at);
        assert!(stored.entries.is_empty());
    }

    #[test]
    fn cleans_only_managed_orphans() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("data/photos/thumbs")).unwrap();
        fs::write(
            dir.path().join("data/photos/2026-11-08-a1b2c3d4.webp"),
            b"x",
        )
        .unwrap();
        fs::write(
            dir.path()
                .join("data/photos/thumbs/2026-11-08-a1b2c3d4.webp"),
            b"x",
        )
        .unwrap();
        fs::write(
            dir.path().join("data/photos/2026-11-08-deadbeef.webp"),
            b"x",
        )
        .unwrap();
        fs::write(dir.path().join("data/photos/keep.txt"), b"x").unwrap();
        let manifest = Manifest {
            version: 1,
            updated_at: "2026-11-15T10:00:00Z".to_string(),
            entries: vec![entry("2026-11-08")],
        };
        let removed = cleanup_orphans(dir.path(), &manifest).unwrap();
        assert_eq!(removed, vec!["data/photos/2026-11-08-deadbeef.webp"]);
        assert!(dir.path().join("data/photos/keep.txt").exists());
    }
}
