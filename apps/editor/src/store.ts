import type { AppEntry, EntryView, GitStatus, ImportDraft, SecretStatus, Settings } from './api';

export type View = 'gallery' | 'import' | 'settings' | 'detail';

export interface DraftState {
  draft: ImportDraft;
  date: string;
  caption: string;
  overwrite: boolean;
  generating: boolean;
  captionModel?: string;
  captionPromptVersion?: number;
  error?: string;
}

export interface AppState {
  view: View;
  settings: Settings | null;
  secret: SecretStatus | null;
  entries: EntryView[];
  drafts: DraftState[];
  selectedDate: string | null;
  gitStatus: GitStatus | null;
  loading: boolean;
  busy: string | null;
  error: string | null;
}

export function initialYearMonth(entries: EntryView[]): {
  year: number | null;
  month: number | null;
} {
  const latest = entries[0]?.entry.date;
  if (!latest) return { year: null, month: null };
  return { year: Number(latest.slice(0, 4)), month: Number(latest.slice(5, 7)) };
}

export function filterEntries(
  entries: EntryView[],
  year: number | null,
  month: number | null,
): EntryView[] {
  return entries.filter(({ entry }) => {
    if (year !== null && Number(entry.date.slice(0, 4)) !== year) return false;
    if (month !== null && Number(entry.date.slice(5, 7)) !== month) return false;
    return true;
  });
}

export function availableYears(entries: EntryView[]): number[] {
  return [...new Set(entries.map(({ entry }) => Number(entry.date.slice(0, 4))))].sort(
    (a, b) => b - a,
  );
}

export function entryForDate(entries: EntryView[], date: string): AppEntry | null {
  return entries.find(({ entry }) => entry.date === date)?.entry ?? null;
}

export function draftsForDate(drafts: DraftState[], date: string): DraftState[] {
  return drafts.filter((draft) => draft.date === date);
}

export function canSaveDrafts(drafts: DraftState[]): boolean {
  if (drafts.length === 0) return false;
  return drafts.every((draft) => {
    if (draft.generating) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return false;
    if (!draft.caption.trim()) return false;
    if (draft.draft.conflict && !draft.overwrite) return false;
    if (draftsForDate(drafts, draft.date).length > 1) return false;
    return true;
  });
}

export function makeDraftState(draft: ImportDraft): DraftState {
  return {
    draft,
    date: draft.date ?? '',
    caption: '',
    overwrite: false,
    generating: false,
  };
}

export function markBatchConflicts(drafts: ImportDraft[]): ImportDraft[] {
  const counts = new Map<string, number>();
  for (const draft of drafts) {
    if (draft.date) counts.set(draft.date, (counts.get(draft.date) ?? 0) + 1);
  }
  return drafts.map((draft) => ({
    ...draft,
    batchConflict: draft.date ? (counts.get(draft.date) ?? 0) > 1 : false,
  }));
}

export function markDraftConflict(draft: DraftState, entries: EntryView[]): void {
  if (!draft.date) return;
  draft.draft.conflict = entryForDate(entries, draft.date);
}
