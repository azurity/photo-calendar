use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

use crate::deepseek::DeepSeekClient;
use crate::error::{AppError, AppResult};
use crate::exif_meta::read_photo_exif;
use crate::git::{GitClient, GitStatus, PublishResult};
use crate::image_pipeline::{image_data_url, prepare_api_image, preview_data_url, process_photo};
use crate::manifest::{cleanup_orphans, now_iso, validate_caption, Entry, Manifest};
use crate::settings::{Settings, SettingsLoad};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryView {
    pub entry: Entry,
    pub thumbnail_data_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDraft {
    pub id: String,
    pub source_path: String,
    pub preview_data_url: String,
    pub date: Option<String>,
    pub captured_at: Option<String>,
    pub conflict: Option<Entry>,
    pub batch_conflict: bool,
    pub error: Option<String>,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDraft {
    pub source_path: String,
    pub date: String,
    pub caption: String,
    pub captured_at: Option<String>,
    pub overwrite: bool,
    pub caption_source: Option<String>,
    pub caption_model: Option<String>,
    pub caption_prompt_version: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub entries: Vec<Entry>,
    pub publish: Option<PublishResult>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub ok: bool,
    pub message: String,
    pub model: Option<String>,
    pub head: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResult {
    pub deleted: bool,
    pub publish: Option<PublishResult>,
}

#[tauri::command]
pub fn settings_get(state: State<'_, AppState>) -> AppResult<SettingsLoad> {
    state.settings_store.load()
}

#[tauri::command]
pub async fn settings_save(settings: Settings, state: State<'_, AppState>) -> AppResult<Settings> {
    let previous = state.settings()?;
    let changed_remote = previous.git.remote_url != settings.git.remote_url;
    let changed_worktree = previous.git.worktree_path != settings.git.worktree_path;
    if (changed_remote || changed_worktree) && !previous.git.remote_url.is_empty() {
        let status = GitClient::from_settings(&previous.git).status().await?;
        if status.pending {
            return Err(AppError::new(
                "GIT_PENDING_CHANGES",
                "本地还有未发布的改动，请先发布或确认放弃后再切换仓库/工作副本",
            ));
        }
    }
    state.settings_store.save(&settings)?;
    Ok(settings)
}

#[tauri::command]
pub fn secret_status(state: State<'_, AppState>) -> crate::secrets::SecretStatus {
    state.secret.status()
}

#[tauri::command]
pub fn secret_set(
    key: String,
    state: State<'_, AppState>,
) -> AppResult<crate::secrets::SecretStatus> {
    state.secret.set_key(&key)
}

#[tauri::command]
pub fn secret_clear(state: State<'_, AppState>) -> AppResult<crate::secrets::SecretStatus> {
    state.secret.clear()
}

#[tauri::command]
pub async fn settings_test_deepseek(state: State<'_, AppState>) -> AppResult<TestResult> {
    let settings = state.settings()?;
    let key = state.secret.get_key()?;
    let client = DeepSeekClient::new(
        settings.deepseek.base_url,
        settings.deepseek.model.clone(),
        key,
    )?;
    let model = client.test_connection().await?;
    Ok(TestResult {
        ok: true,
        message: "DeepSeek 连接成功".to_string(),
        model: Some(model),
        head: None,
    })
}

#[tauri::command]
pub async fn settings_test_git(state: State<'_, AppState>) -> AppResult<TestResult> {
    let settings = state.settings()?;
    let client = GitClient::from_settings(&settings.git);
    let head = client.validate_remote().await?;
    Ok(TestResult {
        ok: true,
        message: "Git 仓库可访问".to_string(),
        model: None,
        head: Some(head),
    })
}

#[tauri::command]
pub async fn repo_validate(state: State<'_, AppState>) -> AppResult<TestResult> {
    settings_test_git(state).await
}

#[tauri::command]
pub fn entries_list(state: State<'_, AppState>) -> AppResult<Vec<EntryView>> {
    entries_list_at(&state.worktree()?)
}

pub(crate) fn entries_list_at(root: &std::path::Path) -> AppResult<Vec<EntryView>> {
    let manifest = Manifest::load(root)?;
    Ok(manifest
        .sorted_entries()
        .into_iter()
        .map(|entry| {
            let path = root.join(&entry.thumbnail);
            let thumbnail_data_url = image_data_url(&path).unwrap_or_default();
            EntryView {
                entry,
                thumbnail_data_url,
            }
        })
        .collect())
}

#[tauri::command]
pub fn entry_get(date: String, state: State<'_, AppState>) -> AppResult<EntryView> {
    entry_get_at(&state.worktree()?, &date)
}

pub(crate) fn entry_get_at(root: &std::path::Path, date: &str) -> AppResult<EntryView> {
    let manifest = Manifest::load(root)?;
    let entry = manifest
        .entries
        .iter()
        .find(|entry| entry.date == date)
        .cloned()
        .ok_or_else(|| AppError::new("DATA_INVALID", "找不到这一天的条目"))?;
    let thumbnail_data_url = image_data_url(&root.join(&entry.thumbnail)).unwrap_or_default();
    Ok(EntryView {
        entry,
        thumbnail_data_url,
    })
}

#[tauri::command]
pub fn entry_image(date: String, state: State<'_, AppState>) -> AppResult<String> {
    let root = state.worktree()?;
    let manifest = Manifest::load(&root)?;
    let entry = manifest
        .entries
        .iter()
        .find(|entry| entry.date == date)
        .ok_or_else(|| AppError::new("DATA_INVALID", "找不到这一天的条目"))?;
    image_data_url(&root.join(&entry.photo))
}

#[tauri::command]
pub async fn entry_delete(date: String, state: State<'_, AppState>) -> AppResult<DeleteResult> {
    let root = state.worktree()?;
    let settings = state.settings()?;
    let _entry = entry_delete_at(&root, &date)?;
    let publish = maybe_publish(&state, &settings).await;
    Ok(DeleteResult {
        deleted: true,
        publish,
    })
}

pub(crate) fn entry_delete_at(root: &std::path::Path, date: &str) -> AppResult<Entry> {
    let mut manifest = Manifest::load(root)?;
    let entry = manifest
        .entries
        .iter()
        .find(|entry| entry.date == date)
        .cloned()
        .ok_or_else(|| AppError::new("DATA_INVALID", "找不到这一天的条目"))?;
    manifest.entries.retain(|candidate| candidate.date != date);
    manifest.save(root)?;
    let _ = fs::remove_file(root.join(&entry.photo));
    let _ = fs::remove_file(root.join(&entry.thumbnail));
    let _ = cleanup_orphans(root, &manifest);
    Ok(entry)
}

#[tauri::command]
pub async fn caption_save(
    date: String,
    caption: String,
    state: State<'_, AppState>,
) -> AppResult<Entry> {
    let root = state.worktree()?;
    let settings = state.settings()?;
    let saved = caption_save_at(&root, &date, &caption)?;
    let _ = maybe_publish(&state, &settings).await;
    Ok(saved)
}

pub(crate) fn caption_save_at(
    root: &std::path::Path,
    date: &str,
    caption: &str,
) -> AppResult<Entry> {
    validate_caption(caption)?;
    let mut manifest = Manifest::load(root)?;
    let entry = manifest
        .entries
        .iter_mut()
        .find(|entry| entry.date == date)
        .ok_or_else(|| AppError::new("DATA_INVALID", "找不到这一天的条目"))?;
    entry.caption = caption.to_string();
    entry.caption_source = Some("manual".to_string());
    entry.caption_updated_at = Some(now_iso());
    entry.updated_at = now_iso();
    let saved = entry.clone();
    manifest.save(root)?;
    Ok(saved)
}

#[tauri::command]
pub async fn photos_preview_import(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<Vec<ImportDraft>> {
    preview_import_at(&state.worktree()?, paths)
}

pub(crate) fn preview_import_at(
    root: &std::path::Path,
    paths: Vec<String>,
) -> AppResult<Vec<ImportDraft>> {
    let manifest = Manifest::load(root)?;
    let mut drafts = Vec::new();
    for path in paths {
        let id = uuid::Uuid::new_v4().to_string();
        let source = PathBuf::from(&path);
        match preview_data_url(&source) {
            Ok(preview) => {
                let exif = read_photo_exif(&source).unwrap_or_default();
                let conflict = exif.date.as_ref().and_then(|date| {
                    manifest
                        .entries
                        .iter()
                        .find(|entry| &entry.date == date)
                        .cloned()
                });
                drafts.push(ImportDraft {
                    id,
                    source_path: path,
                    preview_data_url: preview,
                    date: exif.date,
                    captured_at: exif.captured_at,
                    conflict,
                    batch_conflict: false,
                    error: None,
                    warning: exif.warning,
                });
            }
            Err(error) => drafts.push(ImportDraft {
                id,
                source_path: path,
                preview_data_url: String::new(),
                date: None,
                captured_at: None,
                conflict: None,
                batch_conflict: false,
                error: Some(error.message),
                warning: None,
            }),
        }
    }
    let counts = drafts.iter().filter_map(|draft| draft.date.clone()).fold(
        std::collections::HashMap::<String, usize>::new(),
        |mut map, date| {
            *map.entry(date).or_default() += 1;
            map
        },
    );
    for draft in &mut drafts {
        if let Some(date) = &draft.date {
            draft.batch_conflict = counts.get(date).copied().unwrap_or(0) > 1;
        }
    }
    Ok(drafts)
}

#[tauri::command]
pub async fn caption_generate(
    path: String,
    date: String,
    facts: String,
    previous: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<crate::deepseek::CaptionCandidate> {
    if chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d").is_err() {
        return Err(AppError::new("DATA_INVALID", "日期格式无效"));
    }
    let root = state.worktree()?;
    let source = if PathBuf::from(&path).is_absolute() {
        PathBuf::from(&path)
    } else {
        root.join(&path)
    };
    if !source.is_file() {
        return Err(AppError::new("IMAGE_INVALID", "照片文件不存在"));
    }
    {
        let mut generating = state.generating.lock().unwrap();
        if !generating.insert(date.clone()) {
            return Err(AppError::new("CAPTION_BUSY", "这一天的文案正在生成中"));
        }
    }
    let result = async {
        let settings = state.settings()?;
        let key = state.secret.get_key()?;
        let image = prepare_api_image(&source)?;
        let client = DeepSeekClient::new(settings.deepseek.base_url, settings.deepseek.model, key)?;
        let previous = previous.filter(|value| !value.trim().is_empty());
        client
            .generate(&image, &date, &facts, previous.as_deref())
            .await
    }
    .await;
    state.generating.lock().unwrap().remove(&date);
    result
}

#[tauri::command]
pub async fn entry_save(
    drafts: Vec<SaveDraft>,
    state: State<'_, AppState>,
) -> AppResult<SaveResult> {
    let root = state.worktree()?;
    let settings = state.settings()?;
    let entries = save_entries_at(&root, drafts)?;
    let publish = maybe_publish(&state, &settings).await;
    Ok(SaveResult { entries, publish })
}

pub(crate) fn save_entries_at(
    root: &std::path::Path,
    drafts: Vec<SaveDraft>,
) -> AppResult<Vec<Entry>> {
    if drafts.is_empty() {
        return Err(AppError::new("DATA_INVALID", "没有待保存的草稿"));
    }
    let mut manifest = Manifest::load(root)?;
    let previous_assets: HashSet<String> = manifest
        .entries
        .iter()
        .flat_map(|entry| [entry.photo.clone(), entry.thumbnail.clone()])
        .collect();
    let mut created_assets: Vec<PathBuf> = Vec::new();
    let mut old_assets: Vec<String> = Vec::new();
    let mut saved_entries: Vec<Entry> = Vec::new();

    let transaction = (|| -> AppResult<()> {
        let mut seen_dates = HashSet::new();
        for draft in drafts {
            if !seen_dates.insert(draft.date.clone()) {
                return Err(AppError::new(
                    "DATA_INVALID",
                    format!("同一次保存中日期重复：{}", draft.date),
                ));
            }
            chrono::NaiveDate::parse_from_str(&draft.date, "%Y-%m-%d")
                .map_err(|_| AppError::new("DATA_INVALID", "日期格式无效"))?;
            validate_caption(&draft.caption)?;
            let existing = manifest
                .entries
                .iter()
                .find(|entry| entry.date == draft.date)
                .cloned();
            if existing.is_some() && !draft.overwrite {
                return Err(AppError::new(
                    "CONFLICT",
                    format!("{} 已经有照片，需要确认覆盖", draft.date),
                ));
            }
            let source = PathBuf::from(&draft.source_path);
            let exif = read_photo_exif(&source)?;
            let processed = process_photo(&source, root, &draft.date, &exif)?;
            if !previous_assets.contains(&processed.photo) {
                created_assets.push(root.join(&processed.photo));
            }
            if !previous_assets.contains(&processed.thumbnail) {
                created_assets.push(root.join(&processed.thumbnail));
            }
            let now = now_iso();
            let captured_at = draft
                .captured_at
                .or(exif.captured_at)
                .filter(|value| value.starts_with(&draft.date));
            let entry = Entry {
                date: draft.date.clone(),
                photo: processed.photo,
                thumbnail: processed.thumbnail,
                caption: draft.caption,
                caption_source: Some(draft.caption_source.unwrap_or_else(|| "manual".to_string())),
                caption_model: draft.caption_model,
                caption_prompt_version: draft.caption_prompt_version,
                caption_updated_at: Some(now.clone()),
                captured_at,
                created_at: existing
                    .as_ref()
                    .map(|entry| entry.created_at.clone())
                    .unwrap_or_else(|| now.clone()),
                updated_at: now,
            };
            if let Some(old) = existing {
                old_assets.push(old.photo);
                old_assets.push(old.thumbnail);
                manifest
                    .entries
                    .retain(|candidate| candidate.date != entry.date);
            }
            manifest.entries.push(entry.clone());
            saved_entries.push(entry);
        }
        manifest.save(root)?;
        Ok(())
    })();

    if let Err(error) = transaction {
        for path in created_assets {
            let _ = fs::remove_file(path);
        }
        return Err(error);
    }

    for asset in old_assets {
        if !manifest
            .entries
            .iter()
            .any(|entry| entry.photo == asset || entry.thumbnail == asset)
        {
            let _ = fs::remove_file(root.join(asset));
        }
    }
    let _ = cleanup_orphans(root, &manifest);
    Ok(saved_entries)
}

async fn publish_with_gate(
    gate: &tokio::sync::Mutex<()>,
    settings: &Settings,
) -> AppResult<PublishResult> {
    let _guard = gate.lock().await;
    GitClient::from_settings(&settings.git).publish().await
}

async fn publish_locked(state: &AppState, settings: &Settings) -> AppResult<PublishResult> {
    publish_with_gate(&state.publish_lock, settings).await
}

pub(crate) fn auto_publish_enabled(settings: &Settings) -> bool {
    settings.git.auto_publish && !settings.git.remote_url.trim().is_empty()
}

async fn maybe_publish(state: &AppState, settings: &Settings) -> Option<PublishResult> {
    if !auto_publish_enabled(settings) {
        return None;
    }
    match publish_locked(state, settings).await {
        Ok(result) => Some(result),
        Err(error) => Some(PublishResult {
            ok: false,
            commit: None,
            pushed_at: None,
            pages_url: GitClient::from_settings(&settings.git).pages_url(),
            actions_url: GitClient::from_settings(&settings.git).actions_url(),
            message: error.message,
            pending: true,
        }),
    }
}

#[tauri::command]
pub async fn git_status(state: State<'_, AppState>) -> AppResult<GitStatus> {
    let settings = state.settings()?;
    GitClient::from_settings(&settings.git).status().await
}

#[tauri::command]
pub async fn git_publish(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> AppResult<PublishResult> {
    let settings = state.settings()?;
    let _ = app.emit(
        "publish:progress",
        serde_json::json!({ "stage": "start", "message": "正在发布" }),
    );
    let result = publish_locked(&state, &settings).await;
    let _ = app.emit(
        "publish:progress",
        serde_json::json!({
            "stage": "finish",
            "ok": result.as_ref().map(|value| value.ok).unwrap_or(false),
            "message": result.as_ref().map(|value| value.message.clone()).unwrap_or_else(|error| error.message.clone())
        }),
    );
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgb};
    use little_exif::exif_tag::ExifTag;
    use little_exif::filetype::FileExtension;
    use little_exif::metadata::Metadata;

    pub(crate) fn make_photo(path: &std::path::Path, day: u8) {
        make_photo_tinted(path, day, 0)
    }

    fn make_photo_tinted(path: &std::path::Path, day: u8, tint: u8) {
        let image: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::from_fn(48, 32, |x, y| {
            Rgb([(x + day as u32 + tint as u32) as u8, y as u8, 90])
        });
        let mut bytes = Vec::new();
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, 90);
        encoder
            .encode_image(&image::DynamicImage::ImageRgb8(image))
            .unwrap();
        let mut metadata = Metadata::new();
        metadata.set_tag(ExifTag::DateTimeOriginal(format!(
            "2026:11:{day:02} 10:00:00"
        )));
        metadata
            .write_to_vec(&mut bytes, FileExtension::JPEG)
            .unwrap();
        fs::write(path, bytes).unwrap();
    }

    pub(crate) fn draft(
        source: &std::path::Path,
        date: &str,
        caption: &str,
        overwrite: bool,
    ) -> SaveDraft {
        SaveDraft {
            source_path: source.to_string_lossy().to_string(),
            date: date.to_string(),
            caption: caption.to_string(),
            captured_at: None,
            overwrite,
            caption_source: Some("manual".to_string()),
            caption_model: None,
            caption_prompt_version: None,
        }
    }

    #[test]
    fn previews_batch_conflicts_and_existing_entries() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("site");
        fs::create_dir_all(&root).unwrap();
        let first = dir.path().join("first.jpg");
        let second = dir.path().join("second.jpg");
        make_photo(&first, 8);
        make_photo_tinted(&second, 8, 20);
        let drafts = preview_import_at(
            &root,
            vec![
                first.to_string_lossy().to_string(),
                second.to_string_lossy().to_string(),
                dir.path().join("missing.jpg").to_string_lossy().to_string(),
            ],
        )
        .unwrap();
        assert_eq!(drafts.len(), 3);
        assert_eq!(drafts[0].date.as_deref(), Some("2026-11-08"));
        assert!(drafts[0].batch_conflict);
        assert!(drafts[1].batch_conflict);
        assert!(drafts[2].error.is_some());

        save_entries_at(
            &root,
            vec![draft(&first, "2026-11-08", "第一天的文案。", false)],
        )
        .unwrap();
        let drafts = preview_import_at(&root, vec![second.to_string_lossy().to_string()]).unwrap();
        assert!(drafts[0].conflict.is_some());
    }

    #[test]
    fn saves_new_entries_and_requires_overwrite_confirmation() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("site");
        fs::create_dir_all(&root).unwrap();
        let first = dir.path().join("first.jpg");
        let second = dir.path().join("second.jpg");
        make_photo(&first, 8);
        make_photo_tinted(&second, 8, 20);

        let saved = save_entries_at(
            &root,
            vec![draft(&first, "2026-11-08", "第一天的文案。", false)],
        )
        .unwrap();
        assert_eq!(saved.len(), 1);
        let manifest = Manifest::load(&root).unwrap();
        assert_eq!(manifest.entries.len(), 1);
        let old_photo = manifest.entries[0].photo.clone();
        assert!(root.join(&old_photo).is_file());

        let conflict = save_entries_at(
            &root,
            vec![draft(&second, "2026-11-08", "覆盖文案。", false)],
        )
        .unwrap_err();
        assert_eq!(conflict.code, "CONFLICT");

        let replaced = save_entries_at(
            &root,
            vec![draft(&second, "2026-11-08", "覆盖后的文案。", true)],
        )
        .unwrap();
        assert_eq!(replaced[0].caption, "覆盖后的文案。");
        let manifest = Manifest::load(&root).unwrap();
        assert_eq!(manifest.entries.len(), 1);
        assert!(
            !root.join(&old_photo).exists(),
            "old asset should be removed"
        );
    }

    #[test]
    fn rolls_back_created_assets_when_a_later_draft_fails() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("site");
        fs::create_dir_all(&root).unwrap();
        let first = dir.path().join("first.jpg");
        make_photo(&first, 9);

        let error = save_entries_at(
            &root,
            vec![
                draft(&first, "2026-11-09", "第一条文案。", false),
                draft(
                    &dir.path().join("missing.jpg"),
                    "2026-11-10",
                    "第二条文案。",
                    false,
                ),
            ],
        )
        .unwrap_err();
        assert!(error.code == "IO_ERROR" || error.code == "IMAGE_INVALID");
        let manifest = Manifest::load(&root).unwrap();
        assert!(manifest.entries.is_empty());
        let leftovers = fs::read_dir(root.join("data/photos"))
            .map(|entries| {
                entries
                    .filter_map(Result::ok)
                    .filter(|entry| {
                        entry
                            .file_type()
                            .map(|kind| kind.is_file())
                            .unwrap_or(false)
                    })
                    .count()
            })
            .unwrap_or(0);
        assert_eq!(leftovers, 0);
    }

    #[test]
    fn lists_gets_updates_and_deletes_entries() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("site");
        fs::create_dir_all(&root).unwrap();
        let source = dir.path().join("photo.jpg");
        make_photo(&source, 8);
        save_entries_at(
            &root,
            vec![draft(&source, "2026-11-08", "列表里的文案。", false)],
        )
        .unwrap();

        let list = entries_list_at(&root).unwrap();
        assert_eq!(list.len(), 1);
        assert!(list[0].thumbnail_data_url.starts_with("data:image/"));
        let got = entry_get_at(&root, "2026-11-08").unwrap();
        assert_eq!(got.entry.caption, "列表里的文案。");

        let updated = caption_save_at(&root, "2026-11-08", "手动修改后的文案。").unwrap();
        assert_eq!(updated.caption_source.as_deref(), Some("manual"));
        assert_eq!(updated.caption, "手动修改后的文案。");

        let deleted = entry_delete_at(&root, "2026-11-08").unwrap();
        assert!(entries_list_at(&root).unwrap().is_empty());
        assert!(!root.join(&deleted.photo).exists());
        assert!(!root.join(&deleted.thumbnail).exists());
    }

    #[test]
    fn auto_publish_requires_the_toggle_and_a_remote() {
        let mut settings =
            crate::settings::Settings::default_for(&crate::settings::AppPaths::from_base(
                std::path::PathBuf::from("/tmp/photo-calendar-test"),
            ));
        settings.git.auto_publish = true;
        settings.git.remote_url = String::new();
        assert!(!auto_publish_enabled(&settings));
        settings.git.remote_url = "https://github.com/example/repo.git".to_string();
        assert!(auto_publish_enabled(&settings));
        settings.git.auto_publish = false;
        assert!(!auto_publish_enabled(&settings));
    }

    #[test]
    fn rejects_unknown_versions_in_manifest_load() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("site");
        fs::create_dir_all(root.join("data")).unwrap();
        fs::write(
            root.join("data/calendar.json"),
            r#"{"version":2,"updatedAt":"2026-11-15T10:00:00Z","entries":[]}"#,
        )
        .unwrap();
        let error = Manifest::load(&root).unwrap_err();
        assert_eq!(error.code, "DATA_INVALID");
    }
}

#[cfg(test)]
mod integration_test {
    use super::*;
    use crate::git::GitClient;
    use crate::settings::GitSettings;
    use std::process::Command;

    fn git(cwd: &std::path::Path, args: &[&str]) -> String {
        let output = Command::new("git")
            .arg("-C")
            .arg(cwd)
            .args(args)
            .env("GIT_AUTHOR_NAME", "Test")
            .env("GIT_AUTHOR_EMAIL", "test@example.com")
            .env("GIT_COMMITTER_NAME", "Test")
            .env("GIT_COMMITTER_EMAIL", "test@example.com")
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git {:?}: {}{}",
            args,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    fn setup_remote(dir: &std::path::Path) -> std::path::PathBuf {
        let remote = dir.join("remote.git");
        let seed = dir.join("seed");
        fs::create_dir_all(&remote).unwrap();
        git(&remote, &["init", "--bare"]);
        fs::create_dir_all(&seed).unwrap();
        git(&seed, &["init"]);
        git(&seed, &["checkout", "-b", "main"]);
        fs::create_dir_all(seed.join(".github/workflows")).unwrap();
        fs::create_dir_all(seed.join("data/photos/thumbs")).unwrap();
        fs::write(
            seed.join("data/calendar.json"),
            r#"{"version":1,"updatedAt":"2026-11-15T10:00:00Z","entries":[]}"#,
        )
        .unwrap();
        fs::write(seed.join(".github/workflows/pages.yml"), "name: Pages\n").unwrap();
        git(&seed, &["add", "."]);
        git(&seed, &["commit", "-m", "init"]);
        git(
            &seed,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        git(&seed, &["push", "-u", "origin", "main"]);
        git(&remote, &["symbolic-ref", "HEAD", "refs/heads/main"]);
        remote
    }

    #[tokio::test]
    async fn saves_an_entry_then_publishes_it_to_a_temp_remote() {
        let dir = tempfile::tempdir().unwrap();
        let remote = setup_remote(dir.path());
        let worktree = dir.path().join("worktree");
        let source = dir.path().join("photo.jpg");
        super::tests::make_photo(&source, 8);

        let settings = GitSettings {
            remote_url: remote.to_string_lossy().to_string(),
            branch: "main".to_string(),
            worktree_path: worktree.to_string_lossy().to_string(),
            auto_publish: true,
            site_url: String::new(),
        };
        let client = GitClient::from_settings(&settings);
        client.publish().await.unwrap();

        save_entries_at(
            &worktree,
            vec![super::tests::draft(
                &source,
                "2026-11-08",
                "集成测试文案。",
                false,
            )],
        )
        .unwrap();
        let result = client.publish().await.unwrap();
        assert!(result.ok, "{}", result.message);
        let log = git(&remote, &["log", "-1", "--format=%s"]);
        assert_eq!(log, "calendar: publish entries");
        let manifest = Manifest::load(&worktree).unwrap();
        assert_eq!(manifest.entries.len(), 1);
    }

    #[tokio::test]
    async fn previews_generates_saves_and_publishes_an_entry() {
        use crate::deepseek::DeepSeekClient;
        use crate::settings::{DeepSeekSettings, Settings};
        use serde_json::json;
        use wiremock::matchers::{method, path};
        use wiremock::{Mock, MockServer, ResponseTemplate};

        let dir = tempfile::tempdir().unwrap();
        let remote = setup_remote(dir.path());
        let worktree = dir.path().join("worktree");
        let source = dir.path().join("photo.jpg");
        super::tests::make_photo(&source, 8);

        let settings = Settings {
            version: 1,
            deepseek: DeepSeekSettings {
                base_url: "https://api.deepseek.com".to_string(),
                model: "deepseek-flash".to_string(),
            },
            git: GitSettings {
                remote_url: remote.to_string_lossy().to_string(),
                branch: "main".to_string(),
                worktree_path: worktree.to_string_lossy().to_string(),
                auto_publish: true,
                site_url: String::new(),
            },
        };
        let client = GitClient::from_settings(&settings.git);
        client.publish().await.unwrap();

        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/chat/completions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "choices": [{
                    "message": { "content": "光落在旧墙上，像一封没有署名的邀请函。" },
                    "finish_reason": "stop"
                }]
            })))
            .mount(&server)
            .await;
        let deepseek = DeepSeekClient::new(
            server.uri(),
            settings.deepseek.model.clone(),
            "sk-test".to_string(),
        )
        .unwrap();
        let candidate = deepseek
            .generate(
                "data:image/jpeg;base64,AA==",
                "2026-11-08",
                "无已知日期特征",
                None,
            )
            .await
            .unwrap();

        let drafts =
            preview_import_at(&worktree, vec![source.to_string_lossy().to_string()]).unwrap();
        let date = drafts[0].date.clone().unwrap();
        save_entries_at(
            &worktree,
            vec![SaveDraft {
                source_path: source.to_string_lossy().to_string(),
                date,
                caption: candidate.caption,
                captured_at: drafts[0].captured_at.clone(),
                overwrite: false,
                caption_source: Some("generated".to_string()),
                caption_model: Some(candidate.model),
                caption_prompt_version: Some(candidate.prompt_version),
            }],
        )
        .unwrap();
        assert!(auto_publish_enabled(&settings));
        let result = publish_with_gate(&tokio::sync::Mutex::new(()), &settings)
            .await
            .unwrap();
        assert!(result.ok, "{}", result.message);
        let log = git(&remote, &["log", "-1", "--format=%s"]);
        assert_eq!(log, "calendar: publish entries");
        let manifest = Manifest::load(&worktree).unwrap();
        assert_eq!(
            manifest.entries[0].caption_source.as_deref(),
            Some("generated")
        );
    }
}
