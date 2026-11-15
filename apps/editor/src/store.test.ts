import { describe, expect, it } from 'vitest';
import type { EntryView, ImportDraft } from './api';
import {
  availableYears,
  canSaveDrafts,
  draftsForDate,
  filterEntries,
  makeDraftState,
  markBatchConflicts,
  markDraftConflict,
} from './store';

function view(date: string): EntryView {
  return {
    entry: {
      date,
      photo: `data/photos/${date}-a1b2c3d4.webp`,
      thumbnail: `data/photos/thumbs/${date}-a1b2c3d4.webp`,
      caption: '文案。',
      createdAt: '2026-11-15T09:50:00Z',
      updatedAt: '2026-11-15T09:55:00Z',
    },
    thumbnailDataUrl: 'data:image/png;base64,AA==',
  };
}

function draft(date: string | null, conflict: ImportDraft['conflict'] = null): ImportDraft {
  return {
    id: '1',
    sourcePath: '/tmp/a.jpg',
    previewDataUrl: 'data:image/jpeg;base64,AA==',
    date,
    capturedAt: null,
    conflict,
    batchConflict: false,
    error: null,
    warning: null,
  };
}

describe('editor store helpers', () => {
  it('filters by year and month and lists years', () => {
    const entries = [view('2026-11-08'), view('2026-10-01'), view('2025-01-01')];
    expect(filterEntries(entries, 2026, 11)).toHaveLength(1);
    expect(filterEntries(entries, 2026, null)).toHaveLength(2);
    expect(availableYears(entries)).toEqual([2026, 2025]);
  });

  it('detects batch conflicts', () => {
    const drafts = markBatchConflicts([
      draft('2026-11-08'),
      draft('2026-11-08'),
      draft('2026-11-09'),
    ]);
    expect(drafts[0]?.batchConflict).toBe(true);
    expect(drafts[1]?.batchConflict).toBe(true);
    expect(drafts[2]?.batchConflict).toBe(false);
  });

  it('requires captions and overwrite confirmation', () => {
    const state = makeDraftState(draft('2026-11-08', view('2026-11-08').entry));
    expect(canSaveDrafts([state])).toBe(false);
    state.caption = '一句文案。';
    expect(canSaveDrafts([state])).toBe(false);
    state.overwrite = true;
    expect(canSaveDrafts([state])).toBe(true);
  });

  it('refreshes conflict state when a draft date changes', () => {
    const state = makeDraftState(draft('2026-11-08'));
    markDraftConflict(state, [view('2026-11-08')]);
    expect(state.draft.conflict?.date).toBe('2026-11-08');
    state.date = '2026-11-09';
    markDraftConflict(state, [view('2026-11-08')]);
    expect(state.draft.conflict).toBeNull();
  });

  it('rejects duplicate dates in the same batch', () => {
    const first = makeDraftState(draft('2026-11-08'));
    first.caption = '第一句。';
    const second = makeDraftState(draft('2026-11-08'));
    second.caption = '第二句。';
    expect(draftsForDate([first, second], '2026-11-08')).toHaveLength(2);
    expect(canSaveDrafts([first, second])).toBe(false);
  });
});
