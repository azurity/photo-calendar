import { formatChineseDate } from '@photo-calendar/shared';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { api, AppError, type AppEntry, type EntryView, type SaveDraft, type Settings } from './api';
import { formatDateFacts, getDateFacts } from './date-facts';
import { validateSettings } from './settings-form';
import { missingSetupItems } from './setup';
import {
  availableYears,
  canSaveDrafts,
  draftsForDate,
  entryForDate,
  filterEntries,
  initialYearMonth,
  makeDraftState,
  type AppState,
  markDraftConflict,
  type DraftState,
  type View,
} from './store';
import { clear, confirmAction, dateLabel, errorMessage, h, showToast } from './ui';

const root = document.querySelector<HTMLElement>('#app')!;
let filterYear: number | null = null;
let filterMonth: number | null = null;
let detailImage: string | null = null;
let detailCaption: string | null = null;
let settingsWarning: string | null = null;
let filtersInitialized = false;

const state: AppState = {
  view: 'gallery',
  settings: null,
  secret: null,
  entries: [],
  drafts: [],
  selectedDate: null,
  gitStatus: null,
  loading: true,
  busy: null,
  error: null,
};

function setBusy(label: string | null): void {
  state.busy = label;
  render();
}

function setView(view: View): void {
  state.view = view;
  state.error = null;
  render();
}

function render(): void {
  clear(root);
  root.append(renderShell());
}

function renderShell(): HTMLElement {
  const shell = h('div', { class: 'app-shell film-shell' });
  const sidebar = h('aside', { class: 'sidebar film-canister' });
  const brand = h('div', { class: 'brand-block' }, [
    h('span', { class: 'brand-dot', 'aria-hidden': 'true' }),
    h('div', {}, [h('strong', {}, ['照片日历']), h('span', { class: 'brand-sub' }, ['编辑器'])]),
  ]);
  sidebar.append(brand);

  const nav = h('nav', { class: 'sidebar-nav', 'aria-label': '主导航' });
  const navItem = (view: View, label: string, badge?: string): HTMLElement => {
    const button = h(
      'button',
      {
        class: `nav-item${state.view === view ? ' is-active' : ''}`,
        type: 'button',
        'aria-current': state.view === view ? 'page' : false,
      },
      [label],
    );
    if (badge) button.append(h('span', { class: 'nav-badge' }, [badge]));
    button.addEventListener('click', () => setView(view));
    return button;
  };
  nav.append(
    navItem('gallery', '全部照片', String(state.entries.length)),
    navItem('import', '添加照片'),
    navItem('settings', '设置'),
  );
  sidebar.append(nav);

  const publish = h('div', { class: 'publish-box' });
  publish.append(renderPublishBox());
  sidebar.append(publish);
  shell.append(sidebar);

  const main = h('main', { class: 'editor-main darkroom-desk' });
  if (state.busy) {
    main.append(h('div', { class: 'busy-line', role: 'status' }, [`${state.busy}…`]));
  }
  if (state.error) {
    main.append(h('div', { class: 'error-banner', role: 'alert' }, [state.error]));
  }
  if (!state.loading && missingSetupItems(state.settings, state.secret).length > 0) {
    main.append(renderSetupBanner());
  }
  main.append(renderContent());
  shell.append(main);
  return shell;
}

function renderContent(): HTMLElement {
  if (state.loading) return h('p', { class: 'loading' }, ['正在加载编辑器…']);
  if (state.view === 'settings') return renderSettings();
  if (state.view === 'import') return renderImport();
  if (state.view === 'detail') return renderDetail();
  return renderGallery();
}

function renderSetupBanner(): HTMLElement {
  const missing = missingSetupItems(state.settings, state.secret);
  const banner = h('div', { class: 'setup-banner', role: 'status' }, [
    h('div', {}, [
      h('strong', {}, ['还差一步就能完整使用']),
      h('p', { class: 'muted small' }, [
        `尚未配置：${missing.join('、')}。照片可以先导入并保存在本地，文案与发布稍后配置。`,
      ]),
    ]),
  ]);
  const button = h('button', { class: 'button button-primary button-small', type: 'button' }, [
    '去设置',
  ]);
  button.addEventListener('click', () => setView('settings'));
  banner.append(button);
  return banner;
}

function renderPublishBox(): HTMLElement {
  const box = h('div', { class: 'publish-card' });
  const settings = state.settings;
  if (!settings?.git.remoteUrl) {
    box.append(
      h('p', { class: 'publish-title' }, ['发布']),
      h('p', { class: 'muted' }, ['尚未配置站点仓库。']),
      h('button', { class: 'button button-small button-ghost', type: 'button' }, ['去设置']),
    );
    box.querySelector('button')?.addEventListener('click', () => setView('settings'));
    return box;
  }
  const pending = state.gitStatus?.pending ?? true;
  box.append(
    h('p', { class: 'publish-title' }, ['发布到 GitHub']),
    h('p', { class: `publish-state${pending ? ' is-pending' : ''}` }, [
      state.gitStatus?.message ?? (pending ? '有未发布的改动' : '已同步'),
    ]),
  );
  if (state.gitStatus?.lastCommit) {
    box.append(h('p', { class: 'muted mono' }, [`提交 ${state.gitStatus.lastCommit.slice(0, 8)}`]));
  }
  const button = h(
    'button',
    { class: 'button button-primary', type: 'button', disabled: Boolean(state.busy) },
    [state.busy === '正在发布' ? '正在发布…' : '发布'],
  );
  button.addEventListener('click', () => void publish());
  box.append(button);
  if (state.gitStatus?.pagesUrl) {
    const link = h('button', { class: 'text-link', type: 'button' }, ['打开线上站点 ↗']);
    link.addEventListener('click', () => void openUrl(state.gitStatus?.pagesUrl ?? ''));
    box.append(link);
  }
  if (state.gitStatus?.actionsUrl) {
    const link = h('button', { class: 'text-link', type: 'button' }, ['Actions ↗']);
    link.addEventListener('click', () => void openUrl(state.gitStatus?.actionsUrl ?? ''));
    box.append(link);
  }
  return box;
}

function renderGallery(): HTMLElement {
  const view = h('section', { class: 'view' });
  const years = availableYears(state.entries);
  if (!filtersInitialized && state.entries.length > 0) {
    const initial = initialYearMonth(state.entries);
    filterYear = initial.year;
    filterMonth = initial.month;
    filtersInitialized = true;
  }
  const filtered = filterEntries(state.entries, filterYear, filterMonth);
  const toolbar = h('div', { class: 'view-head' }, [
    h('div', {}, [
      h('h1', {}, ['全部照片']),
      h('p', { class: 'muted' }, [`共 ${state.entries.length} 天，当前显示 ${filtered.length} 天`]),
    ]),
  ]);
  const importButton = h(
    'button',
    { class: 'button button-primary', type: 'button', disabled: Boolean(state.busy) },
    ['＋ 添加照片'],
  );
  importButton.addEventListener('click', () => setView('import'));
  toolbar.append(importButton);
  view.append(toolbar);

  const filters = h('div', { class: 'filters' }, [
    selectField(
      '年份',
      'all',
      [
        ['all', '全部年份'],
        ...years.map((year) => [String(year), `${year} 年`] as [string, string]),
      ],
      filterYear === null ? 'all' : String(filterYear),
      (value) => {
        filterYear = value === 'all' ? null : Number(value);
        filterMonth = null;
        render();
      },
    ),
    selectField(
      '月份',
      'all',
      [
        ['all', '全部月份'],
        ...Array.from(
          { length: 12 },
          (_, index) => [String(index + 1), `${index + 1} 月`] as [string, string],
        ),
      ],
      filterMonth === null ? 'all' : String(filterMonth),
      (value) => {
        filterMonth = value === 'all' ? null : Number(value);
        render();
      },
    ),
  ]);
  view.append(filters);

  if (state.entries.length === 0) {
    const empty = h('div', { class: 'empty-state' }, [
      h('p', { class: 'empty-title' }, ['还没有照片']),
      h('p', { class: 'muted' }, ['从一张照片开始，把今天放进日历里。']),
    ]);
    const button = h('button', { class: 'button button-primary', type: 'button' }, [
      '添加第一张照片',
    ]);
    button.addEventListener('click', () => setView('import'));
    empty.append(button);
    view.append(empty);
    return view;
  }
  if (filtered.length === 0) {
    view.append(
      h('div', { class: 'empty-state' }, [h('p', { class: 'muted' }, ['这个筛选下没有照片。'])]),
    );
    return view;
  }

  const grid = h('div', { class: 'photo-grid contact-sheet' }, [
    // createFilmEdge('horizontal', 'film-edge-top'),
    // createFilmEdge('horizontal', 'film-edge-bottom'),
  ]);
  for (const [index, item] of filtered.entries()) {
    grid.append(renderPhotoCard(item, index));
  }
  view.append(grid);
  return view;
}

function renderPhotoCard(item: EntryView, index: number): HTMLElement {
  const card = h('button', { class: 'photo-card', type: 'button' });
  const image = h('img', {
    class: 'photo-thumb',
    src: item.thumbnailDataUrl,
    alt: `${dateLabel(item.entry.date)}：${item.entry.caption}`,
    loading: 'lazy',
  });
  if (!item.thumbnailDataUrl) image.classList.add('image-missing');
  card.append(
    // createFilmEdge('horizontal', 'film-edge-top'),
    h('div', { class: 'film-edge' }),
    h('span', { class: 'photo-frame-number', 'aria-hidden': 'true' }, [
      `FRAME ${String(index + 1).padStart(2, '0')}`,
    ]),
    image,
    h('span', { class: 'photo-card-date' }, [dateLabel(item.entry.date)]),
    // createFilmEdge('horizontal', 'film-edge-bottom'),
    h('div', { class: 'film-edge' }),
    // h('span', { class: 'photo-card-caption' }, [item.entry.caption]),
  );
  card.addEventListener('click', () => {
    state.selectedDate = item.entry.date;
    detailImage = null;
    detailCaption = null;
    setView('detail');
  });
  return card;
}

function renderDetail(): HTMLElement {
  const entry = state.selectedDate ? entryForDate(state.entries, state.selectedDate) : null;
  if (!entry || !state.selectedDate) {
    return h('div', { class: 'empty-state' }, [h('p', { class: 'muted' }, ['找不到这条记录。'])]);
  }
  const view = h('section', { class: 'view detail-view' });
  const head = h('div', { class: 'view-head' }, [
    h('button', { class: 'button button-ghost', type: 'button' }, ['← 返回图库']),
    h('div', {}, [h('h1', {}, [dateLabel(entry.date)]), h('p', { class: 'muted' }, [entry.photo])]),
  ]);
  head.querySelector('button')?.addEventListener('click', () => setView('gallery'));
  view.append(head);

  if (!detailImage) {
    view.append(
      h('div', { class: 'detail-image loading-image negative-frame' }, ['正在加载照片…']),
    );
    void api
      .entryImage(entry.date)
      .then((image) => {
        detailImage = image;
        if (state.view === 'detail' && state.selectedDate === entry.date) render();
      })
      .catch((error) => showToast(errorMessage(error), 'error'));
  } else {
    view.append(
      h('div', { class: 'detail-image negative-frame' }, [
        h('img', { src: detailImage, alt: `${formatChineseDate(entry.date)}：${entry.caption}` }),
      ]),
    );
  }

  const caption = h('textarea', {
    class: 'caption-editor',
    rows: 5,
    'aria-label': '文案',
  });
  caption.value = detailCaption ?? entry.caption;
  const meta = h('p', { class: 'muted small' }, [
    `${entry.captionSource === 'manual' ? '手动文案' : 'DeepSeek 文案'}${entry.captionModel ? ` · ${entry.captionModel}` : ''}`,
  ]);
  const save = h(
    'button',
    { class: 'button button-primary', type: 'button', disabled: Boolean(state.busy) },
    ['保存文案'],
  );
  save.addEventListener('click', () => void saveCaption(entry, caption.value));
  caption.addEventListener('input', () => {
    detailCaption = caption.value;
  });
  const regenerate = h(
    'button',
    { class: 'button button-ghost', type: 'button', disabled: Boolean(state.busy) },
    ['换一句'],
  );
  regenerate.addEventListener('click', () => void regenerateDetail(entry, caption));
  const remove = h(
    'button',
    { class: 'button button-danger', type: 'button', disabled: Boolean(state.busy) },
    ['删除这一天'],
  );
  remove.addEventListener('click', () => void deleteEntry(entry));
  view.append(
    h('div', { class: 'detail-form lab-card' }, [
      h('label', { class: 'field-label', for: 'detail-caption' }, ['这一天的文案']),
      caption,
      meta,
      h('div', { class: 'button-row' }, [save, regenerate, remove]),
    ]),
  );
  caption.id = 'detail-caption';
  return view;
}

function renderImport(): HTMLElement {
  const view = h('section', { class: 'view' });
  const head = h('div', { class: 'view-head' }, [
    h('div', {}, [
      h('h1', {}, ['添加照片']),
      h('p', { class: 'muted' }, [
        '支持 JPEG、PNG、WebP；拍摄时间来自 EXIF；没有拍摄时间时请手动选择日期。',
      ]),
    ]),
  ]);
  const choose = h(
    'button',
    { class: 'button button-primary', type: 'button', disabled: Boolean(state.busy) },
    ['选择照片…'],
  );
  choose.addEventListener('click', () => void chooseFiles());
  head.append(choose);
  view.append(head);

  if (state.drafts.length === 0) {
    const drop = h('div', { class: 'drop-zone film-gate' }, [
      h('p', { class: 'drop-title' }, ['把照片拖到这里']),
      h('p', { class: 'muted' }, ['或者点击右上角选择照片。']),
    ]);
    drop.addEventListener('click', () => void chooseFiles());
    view.append(drop);
    return view;
  }

  const list = h('div', { class: 'draft-list film-strip' }, [
    // createFilmEdge('horizontal', 'film-edge-top'),
    // createFilmEdge('horizontal', 'film-edge-bottom'),
  ]);
  for (const draft of state.drafts) list.append(renderDraftCard(draft));
  view.append(list);

  const save = h(
    'button',
    {
      class: 'button button-primary button-wide',
      type: 'button',
      disabled: Boolean(state.busy) || !canSaveDrafts(state.drafts),
    },
    [`保存 ${state.drafts.length} 条`],
  );
  save.addEventListener('click', () => void saveDrafts());
  const hint = canSaveDrafts(state.drafts)
    ? '保存后会写入本地数据；开启自动发布时会同时推送。'
    : '请为每条照片补齐日期与文案；同一天只能保留一张，冲突时需勾选覆盖。';
  view.append(h('div', { class: 'save-bar' }, [h('p', { class: 'muted small' }, [hint]), save]));
  return view;
}

function renderDraftCard(draft: DraftState): HTMLElement {
  const card = h('article', { class: 'draft-card' });
  const preview = draft.draft.previewDataUrl
    ? h('img', { class: 'draft-preview', src: draft.draft.previewDataUrl, alt: '照片预览' })
    : h('div', { class: 'draft-preview missing' }, ['预览不可用']);
  const body = h('div', { class: 'draft-body' });

  if (draft.draft.error) {
    body.append(h('p', { class: 'error-text' }, [draft.draft.error]));
    const remove = h('button', { class: 'button button-ghost button-small', type: 'button' }, [
      '移除',
    ]);
    remove.addEventListener('click', () => removeDraft(draft));
    body.append(remove);
    card.append(preview, body);
    return card;
  }

  const dateInput = h('input', { type: 'date', class: 'input', 'aria-label': '拍摄日期' });
  dateInput.value = draft.date;
  dateInput.addEventListener('change', () => {
    draft.date = dateInput.value;
    draft.overwrite = false;
    markDraftConflict(draft, state.entries);
    render();
  });

  const caption = h('textarea', {
    class: 'input caption-input',
    rows: 3,
    placeholder: '这一天的文案…',
    'aria-label': '文案',
  });
  caption.value = draft.caption;
  caption.addEventListener('input', () => {
    draft.caption = caption.value;
    const save = document.querySelector<HTMLButtonElement>('.save-bar .button-primary');
    if (save) save.disabled = !canSaveDrafts(state.drafts) || Boolean(state.busy);
  });

  const conflictDate = draft.date ? entryForDate(state.entries, draft.date) : null;
  const duplicates = draftsForDate(state.drafts, draft.date);
  const conflictRow = h('div', { class: 'draft-conflict' });
  if (conflictDate) {
    const checkbox = h('input', { type: 'checkbox', id: `overwrite-${draft.draft.id}` });
    checkbox.checked = draft.overwrite;
    checkbox.addEventListener('change', () => {
      draft.overwrite = checkbox.checked;
      render();
    });
    conflictRow.append(
      checkbox,
      h('label', { for: `overwrite-${draft.draft.id}` }, [
        `这一天已有照片（${conflictDate.caption.slice(0, 24)}…），保存时覆盖`,
      ]),
    );
  } else if (duplicates.length > 1) {
    conflictRow.append(
      h('p', { class: 'error-text' }, ['这一批里有同一天的多张照片，请只保留一张。']),
    );
  }

  const generate = h(
    'button',
    {
      class: 'button button-ghost button-small',
      type: 'button',
      disabled: draft.generating || Boolean(state.busy),
    },
    [draft.generating ? '生成中…' : draft.caption ? '换一句' : '生成文案'],
  );
  generate.addEventListener('click', () => void generateCaption(draft));

  const remove = h('button', { class: 'button button-ghost button-small', type: 'button' }, [
    '移除',
  ]);
  remove.addEventListener('click', () => removeDraft(draft));

  body.append(
    h('div', { class: 'draft-top' }, [
      h('div', {}, [
        h('p', { class: 'draft-date' }, [draft.date ? dateLabel(draft.date) : '未识别日期']),
        draft.draft.warning ? h('p', { class: 'warning-text' }, [draft.draft.warning]) : h('span'),
      ]),
      remove,
    ]),
    h('label', { class: 'field-label' }, ['日期']),
    dateInput,
    conflictRow,
    h('label', { class: 'field-label' }, ['文案']),
    caption,
    h('div', { class: 'button-row' }, [generate]),
    draft.captionModel
      ? h('p', { class: 'muted small' }, [`由 ${draft.captionModel} 生成`])
      : h('span'),
  );
  card.append(preview, body);
  return card;
}

function renderSettings(): HTMLElement {
  const settings = state.settings;
  const view = h('section', { class: 'view settings-view' });
  view.append(
    h('div', { class: 'view-head' }, [
      h('div', {}, [
        h('h1', {}, ['设置']),
        h('p', { class: 'muted' }, [
          '配置 DeepSeek 与发布仓库。密钥只保存在系统钥匙串或本次会话。',
        ]),
      ]),
    ]),
  );
  if (settingsWarning) {
    view.append(h('p', { class: 'notice', role: 'status' }, [settingsWarning]));
  }
  if (!settings) {
    view.append(h('p', { class: 'muted' }, ['配置尚未加载。']));
    return view;
  }

  const form = h('form', { class: 'settings-form lab-card' });
  const field = (label: string, input: HTMLElement, help?: string): HTMLElement =>
    h('div', { class: 'form-field' }, [
      h('label', { class: 'field-label', for: input.id }, [label]),
      input,
      help ? h('p', { class: 'field-help' }, [help]) : h('span'),
    ]);
  const textInput = (
    id: string,
    value: string,
    type = 'text',
    placeholder = '',
  ): HTMLInputElement => {
    const input = h('input', { class: 'input', id, type, placeholder, autocomplete: 'off' });
    input.value = value;
    return input;
  };

  const baseUrl = textInput('base-url', settings.deepseek.baseUrl, 'url');
  const model = textInput('model', settings.deepseek.model);
  const remote = textInput(
    'remote-url',
    settings.git.remoteUrl,
    'text',
    'https://github.com/you/photo-calendar.git',
  );
  const branch = textInput('branch', settings.git.branch);
  const worktree = textInput(
    'worktree',
    settings.git.worktreePath,
    'text',
    '/absolute/path/to/site',
  );
  const siteUrl = textInput(
    'site-url',
    settings.git.siteUrl,
    'url',
    'https://you.github.io/photo-calendar/',
  );
  const autoPublish = h('input', { id: 'auto-publish', type: 'checkbox' });
  autoPublish.checked = settings.git.autoPublish;

  form.append(
    h('h2', { class: 'section-title' }, ['DeepSeek']),
    field('API Base URL', baseUrl, '默认 https://api.deepseek.com'),
    field('模型', model, '默认 deepseek-flash（支持图片输入）'),
    h('h2', { class: 'section-title' }, ['Git 与发布']),
    field('仓库地址', remote, 'HTTPS 或 SSH；认证交给系统 Git 凭据管理器'),
    field('发布分支', branch),
    field('本地工作副本', worktree, '必须是绝对路径；不存在时首次发布会自动克隆'),
    field('线上站点地址', siteUrl, '用于发布后的链接，可留空'),
    h('div', { class: 'form-field checkbox-field' }, [
      autoPublish,
      h('label', { for: 'auto-publish' }, ['保存照片或文案后自动发布']),
    ]),
  );

  const saveButton = h(
    'button',
    { class: 'button button-primary', type: 'submit', disabled: Boolean(state.busy) },
    ['保存设置'],
  );
  const testDeepSeek = h(
    'button',
    { class: 'button button-ghost', type: 'button', disabled: Boolean(state.busy) },
    ['测试 DeepSeek'],
  );
  const testGit = h(
    'button',
    { class: 'button button-ghost', type: 'button', disabled: Boolean(state.busy) },
    ['测试 Git'],
  );
  testDeepSeek.addEventListener('click', () => void testConnection('deepseek'));
  testGit.addEventListener('click', () => void testConnection('git'));
  form.append(h('div', { class: 'button-row' }, [saveButton, testDeepSeek, testGit]));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveSettings({
      ...settings,
      deepseek: { baseUrl: baseUrl.value.trim(), model: model.value.trim() },
      git: {
        remoteUrl: remote.value.trim(),
        branch: branch.value.trim(),
        worktreePath: worktree.value.trim(),
        autoPublish: autoPublish.checked,
        siteUrl: siteUrl.value.trim(),
      },
    });
  });
  view.append(form);

  const secretBox = h('div', { class: 'secret-box lab-card' }, [
    h('h2', { class: 'section-title' }, ['DeepSeek API Key']),
  ]);
  if (state.secret?.configured) {
    secretBox.append(h('p', { class: 'secret-status' }, [`已配置：${state.secret.masked}`]));
  } else {
    secretBox.append(h('p', { class: 'muted' }, ['尚未配置 API Key，仍可导入照片并手动写文案。']));
  }
  if (state.secret?.warning) {
    secretBox.append(h('p', { class: 'warning-text' }, [state.secret.warning]));
  }
  const keyInput = textInput('api-key', '', 'password', 'sk-…');
  keyInput.autocomplete = 'new-password';
  keyInput.setAttribute('aria-label', 'DeepSeek API Key');
  const saveKey = h('button', { class: 'button button-primary', type: 'button' }, ['保存 Key']);
  saveKey.addEventListener('click', () => void saveSecret(keyInput.value));
  const clearKey = h('button', { class: 'button button-danger', type: 'button' }, ['清除 Key']);
  clearKey.addEventListener('click', () => void clearSecret());
  secretBox.append(
    h('div', { class: 'inline-form' }, [keyInput, saveKey, clearKey]),
    h('p', { class: 'field-help' }, ['Key 写入系统钥匙串；若钥匙串不可用，仅保存在本次会话。']),
  );
  view.append(secretBox);
  return view;
}

function selectField(
  label: string,
  id: string,
  options: Array<[string, string]>,
  value: string,
  onChange: (value: string) => void,
): HTMLElement {
  const select = h('select', { class: 'input', id, 'aria-label': label });
  for (const [optionValue, text] of options) {
    const option = h('option', { value: optionValue }, [text]);
    if (optionValue === value) option.selected = true;
    select.append(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  return h('div', { class: 'filter-field' }, [
    h('label', { class: 'field-label', for: id }, [label]),
    select,
  ]);
}

async function chooseFiles(): Promise<void> {
  try {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: '照片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await previewPaths(paths);
  } catch (error) {
    showToast(errorMessage(error), 'error');
  }
}

async function previewPaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  setBusy('正在读取照片');
  try {
    const drafts = await api.previewImport(paths);
    state.drafts.push(...drafts.map(makeDraftState));
    state.view = 'import';
    state.error = null;
  } catch (error) {
    showToast(errorMessage(error), 'error');
  } finally {
    state.busy = null;
    render();
  }
}

async function generateCaption(draft: DraftState): Promise<void> {
  if (!draft.date) {
    showToast('请先选择日期', 'error');
    return;
  }
  draft.generating = true;
  render();
  try {
    const facts = formatDateFacts(getDateFacts(draft.date));
    const candidate = await api.captionGenerate(
      draft.draft.sourcePath,
      draft.date,
      facts,
      draft.caption || null,
    );
    draft.caption = candidate.caption;
    draft.captionModel = candidate.model;
    draft.captionPromptVersion = candidate.promptVersion;
    draft.error = undefined;
  } catch (error) {
    if (error instanceof AppError && error.code === 'SECRET_MISSING') {
      state.view = 'settings';
      showToast('请先配置 DeepSeek API Key', 'error');
    } else {
      showToast(errorMessage(error), 'error');
    }
  } finally {
    draft.generating = false;
    render();
  }
}

async function saveDrafts(): Promise<void> {
  if (state.busy) return;
  if (!canSaveDrafts(state.drafts)) {
    showToast('请补齐日期与文案，并处理同一天冲突', 'error');
    return;
  }
  setBusy('正在保存');
  try {
    const payload: SaveDraft[] = state.drafts
      .filter((draft) => !draft.draft.error)
      .map((draft) => ({
        sourcePath: draft.draft.sourcePath,
        date: draft.date,
        caption: draft.caption,
        capturedAt: draft.draft.capturedAt,
        overwrite: draft.overwrite,
        captionSource: draft.captionModel ? 'generated' : 'manual',
        captionModel: draft.captionModel,
        captionPromptVersion: draft.captionPromptVersion,
      }));
    const result = await api.entrySave(payload);
    state.drafts = [];
    state.entries = await api.entriesList();
    state.gitStatus = await api.gitStatus();
    state.view = 'gallery';
    if (result.publish) {
      showToast(result.publish.message, result.publish.ok ? 'success' : 'error');
    } else {
      showToast('已保存到本地', 'success');
    }
    filterYear = null;
    filterMonth = null;
    filtersInitialized = false;
  } catch (error) {
    if (error instanceof AppError && error.code === 'CONFLICT') {
      showToast('这一天已有照片，请勾选覆盖后再保存', 'error');
    } else {
      showToast(errorMessage(error), 'error');
    }
  } finally {
    state.busy = null;
    render();
  }
}

async function saveCaption(entry: AppEntry, caption: string): Promise<void> {
  setBusy('正在保存文案');
  try {
    await api.captionSave(entry.date, caption.trim());
    state.entries = await api.entriesList();
    showToast('文案已保存', 'success');
  } catch (error) {
    showToast(errorMessage(error), 'error');
  } finally {
    state.busy = null;
    render();
  }
}

async function regenerateDetail(entry: AppEntry, textarea: HTMLTextAreaElement): Promise<void> {
  if (entry.captionSource === 'manual') {
    const confirmed = await confirmAction('这条文案是手动编辑的，换一句会覆盖它。继续吗？');
    if (!confirmed) return;
  }
  setBusy('正在生成文案');
  try {
    const candidate = await api.captionGenerate(
      entry.photo,
      entry.date,
      formatDateFacts(getDateFacts(entry.date)),
      textarea.value || null,
    );
    detailCaption = candidate.caption;
    showToast('生成了新的候选文案，保存后才会生效', 'info');
  } catch (error) {
    showToast(errorMessage(error), 'error');
  } finally {
    state.busy = null;
    render();
  }
}

async function deleteEntry(entry: AppEntry): Promise<void> {
  const confirmed = await confirmAction(
    `确定删除 ${formatChineseDate(entry.date)} 的照片与文案吗？`,
  );
  if (!confirmed) return;
  setBusy('正在删除');
  try {
    const result = await api.entryDelete(entry.date);
    state.entries = await api.entriesList();
    state.gitStatus = await api.gitStatus();
    state.view = 'gallery';
    state.selectedDate = null;
    showToast(result.publish?.message ?? '已删除', 'success');
  } catch (error) {
    showToast(errorMessage(error), 'error');
  } finally {
    state.busy = null;
    render();
  }
}

function removeDraft(draft: DraftState): void {
  state.drafts = state.drafts.filter((candidate) => candidate !== draft);
  render();
}

async function saveSettings(settings: Settings): Promise<void> {
  const errors = validateSettings(settings);
  if (errors.length > 0) {
    showToast(errors[0] ?? '设置无效', 'error');
    return;
  }
  setBusy('正在保存设置');
  try {
    state.settings = await api.settingsSave(settings);
    settingsWarning = null;
    state.gitStatus = await api.gitStatus();
    showToast('设置已保存', 'success');
  } catch (error) {
    showToast(errorMessage(error), 'error');
  } finally {
    state.busy = null;
    render();
  }
}

async function saveSecret(key: string): Promise<void> {
  if (!key.trim()) {
    showToast('请输入 API Key', 'error');
    return;
  }
  setBusy('正在保存密钥');
  try {
    state.secret = await api.secretSet(key.trim());
    showToast('API Key 已保存', 'success');
  } catch (error) {
    showToast(errorMessage(error), 'error');
  } finally {
    state.busy = null;
    render();
  }
}

async function clearSecret(): Promise<void> {
  const confirmed = await confirmAction('确定清除 DeepSeek API Key 吗？');
  if (!confirmed) return;
  setBusy('正在清除密钥');
  try {
    state.secret = await api.secretClear();
    showToast('API Key 已清除', 'success');
  } catch (error) {
    showToast(errorMessage(error), 'error');
  } finally {
    state.busy = null;
    render();
  }
}

async function testConnection(kind: 'deepseek' | 'git'): Promise<void> {
  setBusy(kind === 'deepseek' ? '正在测试 DeepSeek' : '正在测试 Git');
  try {
    const result = kind === 'deepseek' ? await api.testDeepSeek() : await api.testGit();
    showToast(result.message, 'success');
  } catch (error) {
    showToast(errorMessage(error), 'error');
  } finally {
    state.busy = null;
    render();
  }
}

async function publish(): Promise<void> {
  if (state.busy) return;
  setBusy('正在发布');
  try {
    const result = await api.gitPublish();
    state.gitStatus = await api.gitStatus();
    showToast(result.message, result.ok ? 'success' : 'error');
  } catch (error) {
    showToast(errorMessage(error), 'error');
    state.gitStatus = await api.gitStatus().catch(() => null);
  } finally {
    state.busy = null;
    render();
  }
}

async function boot(): Promise<void> {
  root.replaceChildren(h('p', { class: 'loading' }, ['正在打开照片日历…']));
  try {
    const load = await api.settingsGet();
    state.settings = load.settings;
    settingsWarning = load.warning;
    state.secret = await api.secretStatus();
    state.entries = await api.entriesList();
    state.gitStatus = await api.gitStatus().catch(() => null);
    state.loading = false;
    state.view = 'gallery';
    if (state.entries.length === 0) state.view = 'gallery';
    try {
      const webview = getCurrentWebview();
      await webview.onDragDropEvent((event) => {
        if (event.payload.type === 'drop') {
          void previewPaths(event.payload.paths);
        }
      });
    } catch {
      // Drag and drop is only available inside the Tauri webview.
    }
  } catch (error) {
    state.loading = false;
    state.error =
      error instanceof AppError && error.code === 'UNKNOWN'
        ? '无法连接编辑器后端。请通过 Tauri 桌面应用启动。'
        : errorMessage(error);
  }
  render();
}

void boot();
