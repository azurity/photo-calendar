import { invoke } from '@tauri-apps/api/core';

export interface DeepSeekSettings {
  baseUrl: string;
  model: string;
}

export interface GitSettings {
  remoteUrl: string;
  branch: string;
  worktreePath: string;
  autoPublish: boolean;
  siteUrl: string;
}

export interface Settings {
  version: number;
  deepseek: DeepSeekSettings;
  git: GitSettings;
}

export interface SettingsLoad {
  settings: Settings;
  warning: string | null;
}

export interface AppEntry {
  date: string;
  photo: string;
  thumbnail: string;
  caption: string;
  captionSource?: 'generated' | 'manual';
  captionModel?: string;
  captionPromptVersion?: number;
  captionUpdatedAt?: string;
  capturedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntryView {
  entry: AppEntry;
  thumbnailDataUrl: string;
}

export interface ImportDraft {
  id: string;
  sourcePath: string;
  previewDataUrl: string;
  date: string | null;
  capturedAt: string | null;
  conflict: AppEntry | null;
  batchConflict: boolean;
  error: string | null;
  warning: string | null;
}

export interface SaveDraft {
  sourcePath: string;
  date: string;
  caption: string;
  capturedAt: string | null;
  overwrite: boolean;
  captionSource?: 'generated' | 'manual';
  captionModel?: string;
  captionPromptVersion?: number;
}

export interface CaptionCandidate {
  caption: string;
  model: string;
  promptVersion: number;
  generatedAt: string;
}

export interface SaveResult {
  entries: AppEntry[];
  publish: PublishResult | null;
}

export interface DeleteResult {
  deleted: boolean;
  publish: PublishResult | null;
}

export interface PublishResult {
  ok: boolean;
  commit: string | null;
  pushedAt: string | null;
  pagesUrl: string | null;
  actionsUrl: string | null;
  message: string;
  pending: boolean;
}

export interface GitStatus {
  configured: boolean;
  pending: boolean;
  lastCommit: string | null;
  lastCommitAt: string | null;
  pagesUrl: string | null;
  actionsUrl: string | null;
  message: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
  model?: string | null;
  head?: string | null;
}

export interface SecretStatus {
  configured: boolean;
  persistent: boolean;
  masked: string;
  warning?: string | null;
}

export class AppError extends Error {
  readonly code: string;
  readonly details?: string;

  constructor(code: string, message: string, details?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string') {
      return new AppError(
        typeof record.code === 'string' ? record.code : 'UNKNOWN',
        record.message,
        typeof record.details === 'string' ? record.details : undefined,
      );
    }
  }
  return new AppError('UNKNOWN', typeof error === 'string' ? error : '操作失败');
}

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw normalizeError(error);
  }
}

export const api = {
  settingsGet: () => invokeCommand<SettingsLoad>('settings_get'),
  settingsSave: (settings: Settings) => invokeCommand<Settings>('settings_save', { settings }),
  secretStatus: () => invokeCommand<SecretStatus>('secret_status'),
  secretSet: (key: string) => invokeCommand<SecretStatus>('secret_set', { key }),
  secretClear: () => invokeCommand<SecretStatus>('secret_clear'),
  testDeepSeek: () => invokeCommand<TestResult>('settings_test_deepseek'),
  testGit: () => invokeCommand<TestResult>('settings_test_git'),
  entriesList: () => invokeCommand<EntryView[]>('entries_list'),
  entryGet: (date: string) => invokeCommand<EntryView>('entry_get', { date }),
  entryImage: (date: string) => invokeCommand<string>('entry_image', { date }),
  entryDelete: (date: string) => invokeCommand<DeleteResult>('entry_delete', { date }),
  captionSave: (date: string, caption: string) =>
    invokeCommand<AppEntry>('caption_save', { date, caption }),
  previewImport: (paths: string[]) =>
    invokeCommand<ImportDraft[]>('photos_preview_import', { paths }),
  captionGenerate: (path: string, date: string, facts: string, previous: string | null) =>
    invokeCommand<CaptionCandidate>('caption_generate', { path, date, facts, previous }),
  entrySave: (drafts: SaveDraft[]) => invokeCommand<SaveResult>('entry_save', { drafts }),
  gitStatus: () => invokeCommand<GitStatus>('git_status'),
  gitPublish: () => invokeCommand<PublishResult>('git_publish'),
  repoValidate: () => invokeCommand<TestResult>('repo_validate'),
};
