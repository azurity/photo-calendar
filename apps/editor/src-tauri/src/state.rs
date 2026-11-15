use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

use tokio::sync::Mutex as AsyncMutex;

use crate::error::AppResult;
use crate::secrets::SecretManager;
use crate::settings::{AppPaths, Settings, SettingsStore};

pub struct AppState {
    pub settings_store: SettingsStore,
    pub secret: SecretManager,
    pub publish_lock: AsyncMutex<()>,
    pub generating: Mutex<HashSet<String>>,
}

impl AppState {
    pub fn new() -> AppResult<Self> {
        let paths = AppPaths::discover()?;
        paths.ensure()?;
        let settings_store = SettingsStore::new(paths.clone());
        let _ = settings_store.load()?;
        Ok(Self {
            settings_store,
            secret: SecretManager::system(),
            publish_lock: AsyncMutex::new(()),
            generating: Mutex::new(HashSet::new()),
        })
    }

    pub fn settings(&self) -> AppResult<Settings> {
        Ok(self.settings_store.load()?.settings)
    }

    pub fn worktree(&self) -> AppResult<PathBuf> {
        let settings = self.settings()?;
        Ok(PathBuf::from(settings.git.worktree_path))
    }
}
