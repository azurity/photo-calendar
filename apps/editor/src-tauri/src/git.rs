use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use chrono::{DateTime, Utc};
use regex::Regex;
use serde::Serialize;
use tokio::process::Command;
use tokio::time::timeout;

use crate::error::{AppError, AppResult};
use crate::settings::{validate_branch, validate_remote_url, GitSettings};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub configured: bool,
    pub pending: bool,
    pub last_commit: Option<String>,
    pub last_commit_at: Option<String>,
    pub pages_url: Option<String>,
    pub actions_url: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishResult {
    pub ok: bool,
    pub commit: Option<String>,
    pub pushed_at: Option<String>,
    pub pages_url: Option<String>,
    pub actions_url: Option<String>,
    pub message: String,
    pub pending: bool,
}

#[derive(Debug)]
struct GitOutput {
    stdout: String,
    stderr: String,
    status: std::process::ExitStatus,
}

pub struct GitClient {
    remote: String,
    branch: String,
    worktree: PathBuf,
    site_url: String,
}

impl GitClient {
    pub fn from_settings(settings: &GitSettings) -> Self {
        Self {
            remote: settings.remote_url.trim().to_string(),
            branch: settings.branch.trim().to_string(),
            worktree: PathBuf::from(&settings.worktree_path),
            site_url: settings.site_url.trim().to_string(),
        }
    }

    pub fn configured(&self) -> bool {
        !self.remote.is_empty() && !self.branch.is_empty() && !self.worktree.as_os_str().is_empty()
    }

    pub fn pages_url(&self) -> Option<String> {
        if !self.site_url.is_empty() {
            return Some(self.site_url.clone());
        }
        github_repo(&self.remote).map(|(owner, repo)| format!("https://{owner}.github.io/{repo}/"))
    }

    pub fn actions_url(&self) -> Option<String> {
        github_repo(&self.remote)
            .map(|(owner, repo)| format!("https://github.com/{owner}/{repo}/actions"))
    }

    pub async fn status(&self) -> AppResult<GitStatus> {
        let configured = self.configured();
        if !configured {
            return Ok(GitStatus {
                configured: false,
                pending: false,
                last_commit: None,
                last_commit_at: None,
                pages_url: self.pages_url(),
                actions_url: self.actions_url(),
                message: "尚未配置站点仓库".to_string(),
            });
        }
        if !self.worktree.join(".git").exists() {
            return Ok(GitStatus {
                configured: true,
                pending: true,
                last_commit: None,
                last_commit_at: None,
                pages_url: self.pages_url(),
                actions_url: self.actions_url(),
                message: "工作副本尚未创建，首次发布会自动克隆".to_string(),
            });
        }
        let pending = self.has_pending_changes().await.unwrap_or(false);
        let (last_commit, last_commit_at) = self.last_commit().await.unwrap_or((None, None));
        Ok(GitStatus {
            configured: true,
            pending,
            last_commit,
            last_commit_at,
            pages_url: self.pages_url(),
            actions_url: self.actions_url(),
            message: if pending {
                "有未发布的改动".to_string()
            } else {
                "本地与待发布状态同步".to_string()
            },
        })
    }

    pub async fn validate_remote(&self) -> AppResult<String> {
        if !self.configured() {
            return Err(AppError::new("CONFIG_MISSING", "请先配置站点仓库与分支"));
        }
        validate_remote_url(&self.remote)?;
        validate_branch(&self.branch)?;
        self.ensure_git().await?;
        let output = self
            .run(
                None,
                &[
                    "ls-remote",
                    "--heads",
                    &self.remote,
                    &format!("refs/heads/{}", self.branch),
                ],
                Duration::from_secs(15),
            )
            .await?;
        if !output.status.success() {
            return Err(self.map_network_error(&output));
        }
        let head = output
            .stdout
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().next())
            .map(str::to_string)
            .ok_or_else(|| {
                AppError::new(
                    "GIT_BRANCH_MISSING",
                    format!("远端分支 {} 不存在", self.branch),
                )
            })?;
        Ok(head)
    }

    pub async fn publish(&self) -> AppResult<PublishResult> {
        if !self.configured() {
            return Err(AppError::new("CONFIG_MISSING", "请先配置站点仓库与分支"));
        }
        validate_remote_url(&self.remote)?;
        validate_branch(&self.branch)?;
        self.ensure_git().await?;
        self.ensure_worktree().await?;
        self.validate_worktree().await?;
        self.check_compatible()?;
        self.sync_before_write().await?;
        self.check_dirty()?;

        let commit = self.commit_if_needed().await?;
        let has_unpushed = self.has_unpushed().await?;
        if commit.is_none() && !has_unpushed {
            return Ok(PublishResult {
                ok: true,
                commit: None,
                pushed_at: None,
                pages_url: self.pages_url(),
                actions_url: self.actions_url(),
                message: "没有需要发布的改动".to_string(),
                pending: false,
            });
        }

        let output = self
            .run(
                Some(&self.worktree),
                &["push", "origin", &format!("HEAD:{}", self.branch)],
                Duration::from_secs(60),
            )
            .await?;
        if !output.status.success() {
            let error = self.map_push_error(&output);
            return Ok(PublishResult {
                ok: false,
                commit,
                pushed_at: None,
                pages_url: self.pages_url(),
                actions_url: self.actions_url(),
                message: error.message,
                pending: true,
            });
        }
        let (commit_hash, _) = self.last_commit().await?;
        Ok(PublishResult {
            ok: true,
            commit: commit.or(commit_hash),
            pushed_at: Some(Utc::now().to_rfc3339()),
            pages_url: self.pages_url(),
            actions_url: self.actions_url(),
            message: "已推送。GitHub Pages 正在构建，稍后刷新线上页面。".to_string(),
            pending: false,
        })
    }

    async fn ensure_git(&self) -> AppResult<()> {
        match Command::new("git").arg("--version").output().await {
            Ok(output) if output.status.success() => Ok(()),
            _ => Err(AppError::new(
                "GIT_NOT_FOUND",
                "未找到系统 Git，请先安装 Git 并确保它在 PATH 中",
            )),
        }
    }

    async fn ensure_worktree(&self) -> AppResult<()> {
        if self.worktree.join(".git").exists() {
            return Ok(());
        }
        if self.worktree.exists() && !self.worktree.is_dir() {
            return Err(AppError::new("GIT_DIRTY", "工作副本路径已存在但不是目录"));
        }
        if self.worktree.exists() {
            let non_empty = std::fs::read_dir(&self.worktree)
                .map(|mut entries| entries.next().is_some())
                .unwrap_or(false);
            if non_empty {
                return Err(AppError::new(
                    "GIT_DIRTY",
                    "工作副本路径非空且不是 Git 仓库，请选择空目录；本地已保存的数据不会被删除",
                ));
            }
        }
        let parent = self
            .worktree
            .parent()
            .ok_or_else(|| AppError::new("CONFIG_INVALID", "工作副本路径没有父目录"))?;
        std::fs::create_dir_all(parent)?;
        let output = self
            .run(
                None,
                &[
                    "clone",
                    "--branch",
                    &self.branch,
                    "--single-branch",
                    &self.remote,
                    &self.worktree.to_string_lossy(),
                ],
                Duration::from_secs(120),
            )
            .await?;
        if !output.status.success() {
            return Err(self.map_network_error(&output));
        }
        Ok(())
    }

    async fn validate_worktree(&self) -> AppResult<()> {
        let output = self
            .run(
                Some(&self.worktree),
                &["remote", "get-url", "origin"],
                Duration::from_secs(10),
            )
            .await?;
        if !output.status.success() {
            return Err(AppError::new("GIT_DIRTY", "工作副本没有 origin 远端"));
        }
        if normalize_remote(output.stdout.trim()) != normalize_remote(&self.remote) {
            return Err(AppError::new(
                "GIT_REMOTE_MISMATCH",
                format!(
                    "工作副本的 origin 是 {}，期望 {}",
                    redact(output.stdout.trim()),
                    redact(&self.remote)
                ),
            ));
        }
        let branch = self
            .run(
                Some(&self.worktree),
                &["rev-parse", "--abbrev-ref", "HEAD"],
                Duration::from_secs(10),
            )
            .await?;
        if !branch.status.success() || branch.stdout.trim() != self.branch {
            return Err(AppError::new(
                "GIT_BRANCH_MISMATCH",
                format!(
                    "工作副本当前分支为 {}，期望 {}",
                    branch.stdout.trim(),
                    self.branch
                ),
            ));
        }
        Ok(())
    }

    fn check_compatible(&self) -> AppResult<()> {
        if !self.worktree.join("data/calendar.json").exists()
            && !self.worktree.join("data").is_dir()
        {
            return Err(AppError::new(
                "REPO_INCOMPATIBLE",
                "目标仓库缺少 data/ 目录，无法写入日历数据",
            ));
        }
        let workflow_dir = self.worktree.join(".github/workflows");
        let has_pages = std::fs::read_dir(&workflow_dir)
            .ok()
            .into_iter()
            .flatten()
            .filter_map(Result::ok)
            .any(|entry| {
                let path = entry.path();
                path.extension().and_then(|value| value.to_str()) == Some("yml")
                    || path.extension().and_then(|value| value.to_str()) == Some("yaml")
            });
        if !has_pages {
            return Err(AppError::new(
                "REPO_INCOMPATIBLE",
                "目标仓库缺少 GitHub Pages 构建工作流",
            ));
        }
        Ok(())
    }

    async fn sync_before_write(&self) -> AppResult<()> {
        let fetch = self
            .run(
                Some(&self.worktree),
                &["fetch", "--prune", "origin"],
                Duration::from_secs(60),
            )
            .await?;
        if !fetch.status.success() {
            return Err(self.map_network_error(&fetch));
        }
        let reference = format!("origin/{}", self.branch);
        let exists = self
            .run(
                Some(&self.worktree),
                &["rev-parse", "--verify", &reference],
                Duration::from_secs(10),
            )
            .await?;
        if !exists.status.success() {
            return Ok(());
        }
        let counts = self
            .run(
                Some(&self.worktree),
                &[
                    "rev-list",
                    "--left-right",
                    "--count",
                    &format!("HEAD...{reference}"),
                ],
                Duration::from_secs(10),
            )
            .await?;
        let parts: Vec<u64> = counts
            .stdout
            .split_whitespace()
            .filter_map(|value| value.parse().ok())
            .collect();
        let (ahead, behind) = (
            parts.first().copied().unwrap_or(0),
            parts.get(1).copied().unwrap_or(0),
        );
        if ahead > 0 && behind > 0 {
            return Err(AppError::new(
                "GIT_DIVERGED",
                "本地与远端已经分叉，请先手动同步，不能强推",
            ));
        }
        if behind > 0 && ahead == 0 {
            let merge = self
                .run(
                    Some(&self.worktree),
                    &["merge", "--ff-only", &reference],
                    Duration::from_secs(30),
                )
                .await?;
            if !merge.status.success() {
                return Err(AppError::new("GIT_DIVERGED", "快进远端失败，请手动同步"));
            }
        }
        Ok(())
    }

    fn check_dirty(&self) -> AppResult<()> {
        let output = std::process::Command::new("git")
            .arg("-C")
            .arg(&self.worktree)
            .args(["status", "--porcelain=v1", "-z"])
            .output()?;
        let status = String::from_utf8_lossy(&output.stdout);
        let mut parts = status.split('\0');
        while let Some(record) = parts.next() {
            if record.is_empty() {
                continue;
            }
            let path = record.get(3..).unwrap_or("");
            if !(path == "data/calendar.json" || path.starts_with("data/photos/")) {
                return Err(AppError::new(
                    "GIT_DIRTY",
                    format!("工作副本存在与发布无关的改动：{path}"),
                ));
            }
            if record.starts_with('R') || record.starts_with('C') {
                let _ = parts.next();
            }
        }
        Ok(())
    }

    async fn commit_if_needed(&self) -> AppResult<Option<String>> {
        let mut add_args = vec!["add", "-A", "--", "data/calendar.json"];
        if self.worktree.join("data/photos").is_dir() {
            add_args.push("data/photos");
        }
        let add = self
            .run(Some(&self.worktree), &add_args, Duration::from_secs(30))
            .await?;
        if !add.status.success() {
            return Err(AppError::new("GIT_COMMIT_FAILED", add.stderr));
        }
        let diff = self
            .run(
                Some(&self.worktree),
                &["diff", "--cached", "--quiet"],
                Duration::from_secs(10),
            )
            .await?;
        if diff.status.success() {
            return Ok(None);
        }
        let output = self
            .run(
                Some(&self.worktree),
                &["commit", "-m", "calendar: publish entries"],
                Duration::from_secs(30),
            )
            .await?;
        if !output.status.success() {
            return Err(AppError::new("GIT_COMMIT_FAILED", redact(&output.stderr)));
        }
        let (hash, _) = self.last_commit().await?;
        Ok(hash)
    }

    async fn has_unpushed(&self) -> AppResult<bool> {
        let reference = format!("origin/{}", self.branch);
        let output = self
            .run(
                Some(&self.worktree),
                &["rev-list", "--count", &format!("{reference}..HEAD")],
                Duration::from_secs(10),
            )
            .await?;
        if !output.status.success() {
            return Ok(true);
        }
        Ok(output.stdout.trim().parse::<u64>().unwrap_or(0) > 0)
    }

    async fn has_pending_changes(&self) -> AppResult<bool> {
        if !self.worktree.join(".git").exists() {
            return Ok(true);
        }
        let output = self
            .run(
                Some(&self.worktree),
                &["status", "--porcelain=v1"],
                Duration::from_secs(10),
            )
            .await?;
        if !output.status.success() {
            return Ok(true);
        }
        if !output.stdout.trim().is_empty() {
            return Ok(true);
        }
        self.has_unpushed().await
    }

    async fn last_commit(&self) -> AppResult<(Option<String>, Option<String>)> {
        if !self.worktree.join(".git").exists() {
            return Ok((None, None));
        }
        let output = self
            .run(
                Some(&self.worktree),
                &["log", "-1", "--format=%H%n%cI"],
                Duration::from_secs(10),
            )
            .await?;
        if !output.status.success() {
            return Ok((None, None));
        }
        let mut lines = output.stdout.lines();
        let hash = lines.next().map(str::to_string);
        let time = lines
            .next()
            .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
            .map(|value| value.with_timezone(&Utc).to_rfc3339());
        Ok((hash, time))
    }

    async fn run(
        &self,
        current_dir: Option<&Path>,
        args: &[&str],
        duration: Duration,
    ) -> AppResult<GitOutput> {
        let mut command = Command::new("git");
        if let Some(dir) = current_dir {
            command.arg("-C").arg(dir);
        }
        command.args(args);
        command
            .kill_on_drop(true)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("GIT_AUTHOR_NAME", "Photo Calendar")
            .env("GIT_AUTHOR_EMAIL", "photo-calendar@example.com")
            .env("GIT_COMMITTER_NAME", "Photo Calendar")
            .env("GIT_COMMITTER_EMAIL", "photo-calendar@example.com")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let child = command.spawn()?;
        let output = timeout(duration, child.wait_with_output())
            .await
            .map_err(|_| AppError::new("GIT_TIMEOUT", "Git 操作超时"))?
            .map_err(|error| AppError::new("GIT_FAILED", error.to_string()))?;
        Ok(GitOutput {
            stdout: redact(&String::from_utf8_lossy(&output.stdout)),
            stderr: redact(&String::from_utf8_lossy(&output.stderr)),
            status: output.status,
        })
    }

    fn map_network_error(&self, output: &GitOutput) -> AppError {
        let text = format!("{}{}", output.stdout, output.stderr).to_ascii_lowercase();
        if text.contains("authentication")
            || text.contains("permission denied")
            || text.contains("could not read username")
            || text.contains("access denied")
        {
            AppError::new("GIT_AUTH", "Git 认证失败，请检查系统凭据或 SSH Agent")
        } else if text.contains("does not appear to be a git repository")
            || text.contains("not found")
            || text.contains("could not resolve host")
        {
            AppError::new("GIT_NETWORK", "Git 远端不可访问或分支不存在")
        } else {
            AppError::new("GIT_NETWORK", redact(&output.stderr).trim().to_string())
        }
    }

    fn map_push_error(&self, output: &GitOutput) -> AppError {
        let text = format!("{}{}", output.stdout, output.stderr).to_ascii_lowercase();
        if text.contains("authentication")
            || text.contains("permission denied")
            || text.contains("could not read username")
        {
            AppError::new("GIT_AUTH", "Git 推送认证失败，请检查系统凭据")
        } else if text.contains("non-fast-forward")
            || text.contains("rejected")
            || text.contains("fetch first")
        {
            AppError::new(
                "GIT_PUSH_REJECTED",
                "远端在发布期间有新的提交，请先同步后再发布",
            )
        } else {
            AppError::new("GIT_NETWORK", redact(&output.stderr).trim().to_string())
        }
    }
}

fn normalize_remote(value: &str) -> String {
    value
        .trim()
        .trim_end_matches('/')
        .trim_end_matches(".git")
        .to_ascii_lowercase()
}

fn github_repo(remote: &str) -> Option<(String, String)> {
    let cleaned = remote.trim().trim_end_matches(".git");
    if let Some(rest) = cleaned.strip_prefix("https://github.com/") {
        let mut parts = rest.split('/');
        let owner = parts.next()?.to_string();
        let repo = parts.next()?.to_string();
        return Some((owner, repo));
    }
    if let Some(rest) = cleaned.strip_prefix("git@github.com:") {
        let mut parts = rest.split('/');
        let owner = parts.next()?.to_string();
        let repo = parts.next()?.to_string();
        return Some((owner, repo));
    }
    None
}

fn redact(value: &str) -> String {
    let regex = Regex::new(r"(https?://)[^/@\s]+@").unwrap();
    regex.replace_all(value, "${1}***@").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_credentials() {
        assert_eq!(
            redact("fatal: https://user:secret@example.com/repo.git"),
            "fatal: https://***@example.com/repo.git"
        );
        assert_eq!(
            github_repo("https://github.com/me/photo-calendar.git"),
            Some(("me".to_string(), "photo-calendar".to_string()))
        );
    }

    #[test]
    fn normalizes_remote_urls() {
        assert_eq!(
            normalize_remote("https://github.com/a/b.git/"),
            normalize_remote("https://github.com/a/b")
        );
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use std::fs;
    use std::process::Command;

    fn git(cwd: &Path, args: &[&str]) -> String {
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
            "git {:?} failed: {}{}",
            args,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    fn setup_remote(dir: &Path) -> (PathBuf, PathBuf) {
        let remote = dir.join("remote.git");
        let seed = dir.join("seed");
        fs::create_dir_all(&remote).unwrap();
        git(&remote, &["init", "--bare"]);
        fs::create_dir_all(&seed).unwrap();
        git(&seed, &["init"]);
        git(&seed, &["checkout", "-b", "main"]);
        fs::create_dir_all(seed.join("data/photos/thumbs")).unwrap();
        fs::create_dir_all(seed.join(".github/workflows")).unwrap();
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
        (remote, seed)
    }

    fn client(remote: &Path, worktree: &Path) -> GitClient {
        GitClient {
            remote: remote.to_string_lossy().to_string(),
            branch: "main".to_string(),
            worktree: worktree.to_path_buf(),
            site_url: String::new(),
        }
    }

    #[tokio::test]
    async fn clones_and_publishes_data_changes() {
        let dir = tempfile::tempdir().unwrap();
        let (remote, _seed) = setup_remote(dir.path());
        let worktree = dir.path().join("worktree");
        let client = client(&remote, &worktree);
        let head = client.validate_remote().await.unwrap();
        assert!(!head.is_empty());
        client.publish().await.unwrap();
        fs::write(
            worktree.join("data/calendar.json"),
            r#"{"version":1,"updatedAt":"2026-11-16T10:00:00Z","entries":[]}"#,
        )
        .unwrap();
        let pending = client.status().await.unwrap();
        assert!(pending.pending);
        let result = client.publish().await.unwrap();
        assert!(result.ok, "{}", result.message);
        let remote_log = Command::new("git")
            .arg("-C")
            .arg(&remote)
            .args(["log", "--oneline", "-1"])
            .output()
            .unwrap();
        assert!(remote_log.status.success());
        let second = client.publish().await.unwrap();
        assert!(second.ok);
        assert!(second.commit.is_none());
    }

    #[tokio::test]
    async fn fast_forwards_when_only_remote_advanced() {
        let dir = tempfile::tempdir().unwrap();
        let (remote, _seed) = setup_remote(dir.path());
        let worktree = dir.path().join("worktree");
        let client = client(&remote, &worktree);
        client.publish().await.unwrap();
        let other = dir.path().join("other");
        git(
            dir.path(),
            &[
                "clone",
                "--branch",
                "main",
                remote.to_str().unwrap(),
                other.to_str().unwrap(),
            ],
        );
        fs::write(other.join("data/calendar.json"), "changed").unwrap();
        git(&other, &["add", "."]);
        git(&other, &["commit", "-m", "remote change"]);
        git(&other, &["push", "origin", "main"]);
        client.publish().await.unwrap();
        assert!(worktree.join("data/calendar.json").exists());
    }

    #[tokio::test]
    async fn rejects_unrelated_working_tree_changes() {
        let dir = tempfile::tempdir().unwrap();
        let (remote, _seed) = setup_remote(dir.path());
        let worktree = dir.path().join("worktree");
        let client = client(&remote, &worktree);
        client.publish().await.unwrap();
        fs::write(worktree.join("README.md"), "unrelated").unwrap();
        let result = client.publish().await;
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().code, "GIT_DIRTY");
    }

    #[tokio::test]
    async fn refuses_to_merge_a_diverged_history() {
        let dir = tempfile::tempdir().unwrap();
        let (remote, _seed) = setup_remote(dir.path());
        let worktree = dir.path().join("worktree");
        let client = client(&remote, &worktree);
        client.publish().await.unwrap();

        let other = dir.path().join("other");
        git(
            dir.path(),
            &[
                "clone",
                "--branch",
                "main",
                remote.to_str().unwrap(),
                other.to_str().unwrap(),
            ],
        );
        fs::write(other.join("data/calendar.json"), "remote").unwrap();
        git(&other, &["add", "."]);
        git(&other, &["commit", "-m", "remote"]);
        git(&other, &["push", "origin", "main"]);

        fs::write(worktree.join("data/calendar.json"), "local").unwrap();
        git(&worktree, &["add", "."]);
        git(&worktree, &["commit", "-m", "local"]);
        let error = client.publish().await.unwrap_err();
        assert_eq!(error.code, "GIT_DIVERGED");
    }

    #[test]
    fn maps_push_failures_without_leaking_credentials() {
        let dir = tempfile::tempdir().unwrap();
        let (remote, _seed) = setup_remote(dir.path());
        let client = client(&remote, &dir.path().join("worktree"));
        let output = GitOutput {
            stdout: String::new(),
            stderr: "fatal: Authentication failed for 'https://user:secret@example.com/repo.git'"
                .to_string(),
            status: std::process::ExitStatus::default(),
        };
        assert_eq!(client.map_push_error(&output).code, "GIT_AUTH");
        let output = GitOutput {
            stdout: String::new(),
            stderr: "! [rejected] main -> main (non-fast-forward)".to_string(),
            status: std::process::ExitStatus::default(),
        };
        assert_eq!(client.map_push_error(&output).code, "GIT_PUSH_REJECTED");
    }

    #[tokio::test]
    async fn rejects_origin_mismatch() {
        let dir = tempfile::tempdir().unwrap();
        let (remote, _seed) = setup_remote(dir.path());
        let worktree = dir.path().join("worktree");
        let client = client(&remote, &worktree);
        client.publish().await.unwrap();
        let other = dir.path().join("other.git");
        fs::create_dir_all(&other).unwrap();
        git(&other, &["init", "--bare"]);
        git(
            &worktree,
            &["remote", "set-url", "origin", other.to_str().unwrap()],
        );
        let result = client.publish().await;
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().code, "GIT_REMOTE_MISMATCH");
    }
}
