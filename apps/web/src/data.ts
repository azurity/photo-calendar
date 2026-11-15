import { makeEmptyManifest, parseManifestLenient, type Manifest } from '@photo-calendar/shared';

export interface CalendarLoadResult {
  manifest: Manifest;
  warnings: string[];
  error?: string;
}

export interface LoadCalendarOptions {
  baseUrl?: string;
  version?: string;
  fetchImpl?: typeof fetch;
}

function defaultVersion(): string {
  return typeof __CALENDAR_VERSION__ === 'string' ? __CALENDAR_VERSION__ : '';
}

export async function loadCalendarData(
  options: LoadCalendarOptions = {},
): Promise<CalendarLoadResult> {
  const baseUrl = options.baseUrl ?? document.baseURI;
  const version = options.version ?? defaultVersion();
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL('data/calendar.json', baseUrl);
  if (version) url.searchParams.set('v', version);

  try {
    const response = await fetchImpl(url, { cache: 'no-cache' });
    if (!response.ok) {
      return {
        manifest: makeEmptyManifest(),
        warnings: [],
        error: `日历数据加载失败（HTTP ${response.status}），暂时以无照片模式展示。`,
      };
    }
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      return {
        manifest: makeEmptyManifest(),
        warnings: [],
        error: '日历数据不是合法 JSON，暂时以无照片模式展示。',
      };
    }
    const parsed = parseManifestLenient(raw);
    return {
      manifest: parsed.manifest,
      warnings: parsed.warnings,
      error: parsed.futureVersion ? '日历数据版本高于当前页面支持的版本，请更新页面。' : undefined,
    };
  } catch {
    return {
      manifest: makeEmptyManifest(),
      warnings: [],
      error: '无法连接到日历数据，暂时以无照片模式展示。',
    };
  }
}

export function resolveAssetPath(path: string, baseUrl = document.baseURI): string {
  return new URL(path, baseUrl).href;
}
