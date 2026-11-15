use std::fs;
use std::io::Write;
use std::path::Path;

use tempfile::NamedTempFile;

use crate::error::{AppError, AppResult};

pub fn atomic_write(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::new("IO_ERROR", "目标路径没有父目录"))?;
    fs::create_dir_all(parent)?;
    let mut temp = NamedTempFile::new_in(parent)?;
    temp.write_all(bytes)?;
    temp.as_file_mut().sync_all()?;
    temp.persist(path).map_err(|error| {
        AppError::new(
            "IO_ERROR",
            format!("无法原子写入 {}：{}", path.display(), error.error),
        )
    })?;
    Ok(())
}

pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> AppResult<Option<T>> {
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(path)?;
    Ok(Some(serde_json::from_slice(&bytes)?))
}

pub fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> AppResult<()> {
    let bytes = serde_json::to_vec_pretty(value)?;
    atomic_write(path, &bytes)
}

pub fn ensure_inside(root: &Path, relative: &str) -> AppResult<std::path::PathBuf> {
    if relative.is_empty()
        || relative.starts_with('/')
        || relative.contains('\\')
        || relative.contains('\0')
        || relative.split('/').any(|part| part == ".." || part == ".")
        || relative.starts_with("data/photos/../")
    {
        return Err(AppError::new(
            "DATA_INVALID",
            format!("资源路径越界或无效：{relative}"),
        ));
    }
    if relative.split(':').next() != Some("") && relative.contains(':') {
        return Err(AppError::new(
            "DATA_INVALID",
            format!("资源路径不能是绝对路径：{relative}"),
        ));
    }
    let root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    let joined = root.join(relative);
    let normalized = joined
        .components()
        .fold(std::path::PathBuf::new(), |mut path, component| {
            use std::path::Component;
            match component {
                Component::ParentDir => {
                    path.pop();
                }
                Component::CurDir => {}
                other => path.push(other.as_os_str()),
            }
            path
        });
    if !normalized.starts_with(&root) {
        return Err(AppError::new(
            "DATA_INVALID",
            format!("资源路径越界：{relative}"),
        ));
    }
    Ok(normalized)
}
