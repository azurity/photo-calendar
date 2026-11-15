import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import type { AppEntry } from './api';

const mocks = vi.hoisted(() => {
  class AppError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  const api = {
    settingsGet: vi.fn(),
    settingsSave: vi.fn(),
    secretStatus: vi.fn(),
    secretSet: vi.fn(),
    secretClear: vi.fn(),
    testDeepSeek: vi.fn(),
    testGit: vi.fn(),
    entriesList: vi.fn(),
    entryGet: vi.fn(),
    entryImage: vi.fn(),
    entryDelete: vi.fn(),
    captionSave: vi.fn(),
    previewImport: vi.fn(),
    captionGenerate: vi.fn(),
    entrySave: vi.fn(),
    gitStatus: vi.fn(),
    gitPublish: vi.fn(),
    repoValidate: vi.fn(),
  };
  return { api, AppError };
});

vi.mock('./api', () => ({ api: mocks.api, AppError: mocks.AppError }));
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({ onDragDropEvent: async () => () => undefined }),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

const settings = {
  version: 1,
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  git: {
    remoteUrl: 'https://github.com/example/photo-calendar.git',
    branch: 'main',
    worktreePath: '/tmp/photo-calendar',
    autoPublish: true,
    siteUrl: 'https://example.github.io/photo-calendar/',
  },
};

const entry: AppEntry = {
  date: '2026-11-08',
  photo: 'data/photos/2026-11-08-a1b2c3d4.webp',
  thumbnail: 'data/photos/thumbs/2026-11-08-a1b2c3d4.webp',
  caption: '风把下午吹得很慢。',
  createdAt: '2026-11-15T09:50:00Z',
  updatedAt: '2026-11-15T09:55:00Z',
};

const secondEntry: AppEntry = {
  ...entry,
  date: '2026-10-01',
  photo: 'data/photos/2026-10-01-a1b2c3d4.webp',
  thumbnail: 'data/photos/thumbs/2026-10-01-a1b2c3d4.webp',
  caption: '十月的第一阵风。',
};

function entryView(item: AppEntry = entry) {
  return { entry: item, thumbnailDataUrl: 'data:image/png;base64,AA==' };
}

function draft(date: string | null = '2026-11-09', conflict: unknown = null) {
  return {
    id: 'draft-1',
    sourcePath: '/tmp/new.jpg',
    previewDataUrl: 'data:image/jpeg;base64,AA==',
    date,
    capturedAt: null,
    conflict,
    batchConflict: false,
    error: null,
    warning: null,
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

async function boot(
  options: {
    entries?: unknown[];
    status?: unknown;
    settings?: unknown;
    secret?: unknown;
    git?: unknown;
  } = {},
): Promise<void> {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  mocks.api.settingsGet.mockResolvedValue({
    settings: options.settings ?? settings,
    warning: null,
  });
  mocks.api.secretStatus.mockResolvedValue(
    options.secret ?? { configured: true, persistent: true, masked: '••••••••1234' },
  );
  mocks.api.entriesList.mockResolvedValue(options.entries ?? [entryView()]);
  mocks.api.gitStatus.mockResolvedValue(
    options.git ?? {
      configured: true,
      pending: false,
      lastCommit: 'abcdef1234567890',
      lastCommitAt: '2026-11-15T10:00:00Z',
      pagesUrl: 'https://example.github.io/photo-calendar/',
      actionsUrl: 'https://github.com/example/photo-calendar/actions',
      message: '本地与待发布状态同步',
    },
  );
  mocks.api.entryImage.mockResolvedValue('data:image/jpeg;base64,AA==');
  mocks.api.previewImport.mockResolvedValue([]);
  mocks.api.captionGenerate.mockResolvedValue({
    caption: '光落在旧墙上，像一封没有署名的邀请函。',
    model: 'deepseek-flash',
    promptVersion: 1,
    generatedAt: '2026-11-15T10:00:00Z',
  });
  mocks.api.entrySave.mockResolvedValue({ entries: [], publish: null });
  mocks.api.entryDelete.mockResolvedValue({ deleted: true, publish: null });
  mocks.api.captionSave.mockResolvedValue(entry);
  mocks.api.gitPublish.mockResolvedValue({
    ok: true,
    commit: 'abcdef1234567890',
    pushedAt: '2026-11-15T10:00:00Z',
    pagesUrl: 'https://example.github.io/photo-calendar/',
    actionsUrl: 'https://github.com/example/photo-calendar/actions',
    message: '已推送。GitHub Pages 正在构建。',
    pending: false,
  });
  mocks.api.settingsSave.mockImplementation(async (value: unknown) => value);
  mocks.api.secretSet.mockResolvedValue({
    configured: true,
    persistent: true,
    masked: '••••••••9999',
  });
  mocks.api.secretClear.mockResolvedValue({ configured: false, persistent: false, masked: '' });
  mocks.api.testDeepSeek.mockResolvedValue({ ok: true, message: 'DeepSeek 连接成功' });
  mocks.api.testGit.mockResolvedValue({ ok: true, message: 'Git 仓库可访问' });
  await import('./main');
  await flush();
  await flush();
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!found) throw new Error(`button not found: ${text}`);
  return found as HTMLButtonElement;
}

function input(id: string): HTMLInputElement | HTMLTextAreaElement {
  const found = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
  if (!found) throw new Error(`input not found: ${id}`);
  return found;
}

function change(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  if (typeof HTMLDialogElement !== 'undefined') {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('editor app', () => {
  it('boots and navigates gallery, import, settings and detail views', async () => {
    await boot();
    expect(document.body.textContent).toContain('全部照片');
    expect(document.body.textContent).toContain('添加照片');
    expect(document.body.textContent).toContain('设置');

    button('添加照片').click();
    expect(document.body.textContent).toContain('选择照片');

    button('设置').click();
    expect(document.body.textContent).toContain('DeepSeek API Key');

    button('全部照片').click();
    document.querySelector<HTMLButtonElement>('.photo-card')?.click();
    await flush();
    expect(document.body.textContent).toContain('2026 年 11 月 8 日');
    expect(mocks.api.entryImage).toHaveBeenCalledWith('2026-11-08');
  });

  it('filters the gallery and shows an empty filtered state', async () => {
    await boot({ entries: [entryView(entry), entryView(secondEntry)] });
    expect(document.querySelectorAll('.photo-card')).toHaveLength(1);

    const year = document.querySelector<HTMLSelectElement>('select[aria-label="年份"]');
    expect(year).not.toBeNull();
    year!.value = 'all';
    change(year!);
    await flush();
    expect(document.querySelectorAll('.photo-card')).toHaveLength(2);

    const month = document.querySelector<HTMLSelectElement>('select[aria-label="月份"]');
    month!.value = '10';
    change(month!);
    await flush();
    expect(document.querySelectorAll('.photo-card')).toHaveLength(1);
    expect(document.body.textContent).toContain('十月的第一阵风');
  });

  it('shows empty state when there are no entries', async () => {
    await boot({ entries: [] });
    expect(document.body.textContent).toContain('还没有照片');
    expect(document.body.textContent).toContain('添加第一张照片');
  });

  it('validates settings before saving and saves the secret', async () => {
    await boot();
    button('设置').click();
    const baseUrl = input('base-url');
    baseUrl.value = 'not-a-url';
    change(baseUrl);
    document
      .querySelector<HTMLFormElement>('.settings-form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(mocks.api.settingsSave).not.toHaveBeenCalled();
    expect(document.querySelector('.toast')?.textContent).toContain('http/https');

    baseUrl.value = 'https://api.deepseek.com';
    change(baseUrl);
    document
      .querySelector<HTMLFormElement>('.settings-form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(mocks.api.settingsSave).toHaveBeenCalledTimes(1);

    const key = input('api-key');
    key.value = 'sk-test-9999';
    button('保存 Key').click();
    await flush();
    expect(mocks.api.secretSet).toHaveBeenCalledWith('sk-test-9999');

    button('清除 Key').click();
    await flush();
    const dialog = document.querySelector<HTMLElement>('.confirm-dialog');
    expect(dialog).not.toBeNull();
    dialog!.querySelector<HTMLButtonElement>('.button-danger')?.click();
    await flush();
    expect(mocks.api.secretClear).toHaveBeenCalled();
  });

  it('previews an import, confirms overwrite and saves the draft', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    (open as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(['/tmp/new.jpg']);
    await boot();
    mocks.api.previewImport.mockResolvedValue([draft('2026-11-08', entry)]);
    button('添加照片').click();
    button('选择照片…').click();
    await vi.waitFor(() => expect(mocks.api.previewImport).toHaveBeenCalledWith(['/tmp/new.jpg']));
    await flush();
    expect(document.body.textContent).toContain('覆盖');

    const caption = document.querySelector<HTMLTextAreaElement>('.caption-input');
    caption!.value = '手动保存的文案。';
    change(caption!);
    const checkbox = document.querySelector<HTMLInputElement>(
      '.draft-conflict input[type="checkbox"]',
    );
    expect(checkbox).not.toBeNull();
    checkbox!.checked = true;
    change(checkbox!);
    await flush();

    button('保存 1 条').click();
    await flush();
    expect(mocks.api.entrySave).toHaveBeenCalledTimes(1);
    const payload = mocks.api.entrySave.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(payload[0]?.overwrite).toBe(true);
    expect(payload[0]?.caption).toBe('手动保存的文案。');
  });

  it('generates a caption for an import draft', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    (open as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(['/tmp/new.jpg']);
    await boot();
    mocks.api.previewImport.mockResolvedValue([draft()]);
    button('添加照片').click();
    button('选择照片…').click();
    await vi.waitFor(() => expect(mocks.api.previewImport).toHaveBeenCalled());
    await flush();
    button('生成文案').click();
    await vi.waitFor(() => expect(mocks.api.captionGenerate).toHaveBeenCalled());
    await flush();
    expect(document.querySelector<HTMLTextAreaElement>('.caption-input')?.value).toContain('旧墙');
  });

  it('switches to settings when the API key is missing', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    (open as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(['/tmp/new.jpg']);
    await boot({ secret: { configured: false, persistent: false, masked: '' } });
    mocks.api.previewImport.mockResolvedValue([draft()]);
    button('添加照片').click();
    button('选择照片…').click();
    await vi.waitFor(() => expect(mocks.api.previewImport).toHaveBeenCalled());
    await flush();
    mocks.api.captionGenerate.mockRejectedValueOnce(
      new mocks.AppError('SECRET_MISSING', '尚未配置 DeepSeek API Key'),
    );
    button('生成文案').click();
    await vi.waitFor(() => expect(mocks.api.captionGenerate).toHaveBeenCalled());
    await flush();
    expect(document.body.textContent).toContain('DeepSeek API Key');
    expect(document.querySelector('.toast')?.textContent).toContain('API Key');
  });

  it('edits and deletes an entry from the detail view', async () => {
    await boot();
    document.querySelector<HTMLButtonElement>('.photo-card')?.click();
    await flush();
    const textarea = document.querySelector<HTMLTextAreaElement>('.caption-editor');
    expect(textarea).not.toBeNull();
    textarea!.value = '更新后的文案。';
    change(textarea!);
    button('保存文案').click();
    await flush();
    expect(mocks.api.captionSave).toHaveBeenCalledWith('2026-11-08', '更新后的文案。');

    button('删除这一天').click();
    await flush();
    document.querySelector<HTMLButtonElement>('.confirm-dialog .button-danger')?.click();
    await flush();
    expect(mocks.api.entryDelete).toHaveBeenCalledWith('2026-11-08');
  });

  it('serializes rapid publish clicks in the UI', async () => {
    await boot({
      git: {
        configured: true,
        pending: true,
        lastCommit: null,
        lastCommitAt: null,
        pagesUrl: null,
        actionsUrl: null,
        message: '有未发布的改动',
      },
    });
    const publishButton = button('发布');
    publishButton.click();
    publishButton.click();
    await vi.waitFor(() => expect(mocks.api.gitPublish).toHaveBeenCalled());
    await flush();
    expect(mocks.api.gitPublish).toHaveBeenCalledTimes(1);
  });

  it('publishes from the sidebar and reflects the result', async () => {
    await boot({
      git: {
        configured: true,
        pending: true,
        lastCommit: null,
        lastCommitAt: null,
        pagesUrl: 'https://example.github.io/photo-calendar/',
        actionsUrl: 'https://github.com/example/photo-calendar/actions',
        message: '有未发布的改动',
      },
    });
    button('发布').click();
    await flush();
    expect(mocks.api.gitPublish).toHaveBeenCalled();
    expect(document.querySelector('.toast')?.textContent).toContain('GitHub Pages');
  });

  it('keeps manual save available when caption generation is offline', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    (open as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(['/tmp/new.jpg']);
    await boot();
    mocks.api.previewImport.mockResolvedValue([draft()]);
    mocks.api.captionGenerate.mockRejectedValue(
      new mocks.AppError('DEEPSEEK_NETWORK', '网络不可达'),
    );
    button('添加照片').click();
    button('选择照片…').click();
    await vi.waitFor(() => expect(mocks.api.previewImport).toHaveBeenCalled());
    await flush();
    button('生成文案').click();
    await vi.waitFor(() => expect(mocks.api.captionGenerate).toHaveBeenCalled());
    await flush();
    expect(document.querySelector('.toast')?.textContent).toContain('网络');

    const caption = document.querySelector<HTMLTextAreaElement>('.caption-input');
    caption!.value = '离线时手动写的文案。';
    change(caption!);
    await flush();
    button('保存 1 条').click();
    await flush();
    expect(mocks.api.entrySave).toHaveBeenCalled();
  });

  it('confirms before regenerating a manually edited caption', async () => {
    await boot({ entries: [entryView({ ...entry, captionSource: 'manual' })] });
    document.querySelector<HTMLButtonElement>('.photo-card')?.click();
    await flush();
    button('换一句').click();
    await flush();
    expect(mocks.api.captionGenerate).not.toHaveBeenCalled();
    const dialog = document.querySelector<HTMLElement>('.confirm-dialog');
    expect(dialog).not.toBeNull();
    dialog!.querySelector<HTMLButtonElement>('.button-danger')?.click();
    await vi.waitFor(() => expect(mocks.api.captionGenerate).toHaveBeenCalled());
  });

  it('blocks saving a batch with two drafts on the same date', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    (open as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(['/tmp/a.jpg', '/tmp/b.jpg']);
    await boot();
    mocks.api.previewImport.mockResolvedValue([
      draft('2026-11-09'),
      { ...draft('2026-11-09'), id: 'draft-2' },
    ]);
    button('添加照片').click();
    button('选择照片…').click();
    await vi.waitFor(() => expect(mocks.api.previewImport).toHaveBeenCalled());
    await flush();
    expect(document.body.textContent).toContain('同一天');
    expect(document.querySelector<HTMLButtonElement>('.save-bar .button-primary')?.disabled).toBe(
      true,
    );
  });

  it('shows a boot error banner when the backend is unavailable', async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    mocks.api.settingsGet.mockRejectedValue(new Error('后端不可用'));
    await import('./main');
    await flush();
    expect(document.querySelector('.error-banner')?.textContent).toContain('后端不可用');
  });

  it('shows a publish failure and refreshes status', async () => {
    await boot({
      git: {
        configured: true,
        pending: true,
        lastCommit: null,
        lastCommitAt: null,
        pagesUrl: null,
        actionsUrl: 'https://github.com/example/photo-calendar/actions',
        message: '有未发布的改动',
      },
    });
    mocks.api.gitPublish.mockResolvedValue({
      ok: false,
      commit: null,
      pushedAt: null,
      pagesUrl: null,
      actionsUrl: null,
      message: '远端拒绝推送',
      pending: true,
    });
    button('发布').click();
    await vi.waitFor(() => expect(mocks.api.gitPublish).toHaveBeenCalled());
    await flush();
    expect(document.querySelector('.toast')?.textContent).toContain('远端拒绝');
    expect(mocks.api.gitStatus.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('has no serious axe violations in the main views', async () => {
    document.documentElement.lang = 'zh-CN';
    document.title = '照片日历编辑器';
    await boot();
    const gallery = await axe.run(document, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(
      gallery.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);

    button('设置').click();
    const settings = await axe.run(document, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(
      settings.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);
  });

  it('provides keyboard-reachable navigation controls', async () => {
    await boot();
    const nav = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-item'));
    expect(nav.length).toBeGreaterThanOrEqual(3);
    nav[1]?.focus();
    expect(document.activeElement).toBe(nav[1]);
    for (const item of nav) {
      expect(item.getAttribute('type')).toBe('button');
      expect(item.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});
