import { z } from 'zod';
import { isValidIsoDate } from './date';

export const CURRENT_SCHEMA_VERSION = 1;
export const MAX_CAPTION_LENGTH = 120;
export const MAX_IMAGE_LONG_EDGE = 2400;
export const THUMBNAIL_LONG_EDGE = 640;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 100_000_000;
export const MAX_API_IMAGE_BYTES = 2 * 1024 * 1024;
export const CAPTION_PROMPT_VERSION = 1;

const isoDateTime = z.string().datetime({ offset: true });
const utcDateTime = isoDateTime.refine((value) => value.endsWith('Z'), {
  message: '时间必须是 UTC ISO 8601 字符串',
});

export function isSafeRepoRelativePath(value: string): boolean {
  if (!value || value.length > 1024) return false;
  if (value.startsWith('/') || value.includes('\\') || value.includes('\0')) return false;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) return false;
  if (value.split('/').includes('..')) return false;
  if (value.split('/').includes('.')) return false;
  return true;
}

const photoPathSchema = z
  .string()
  .refine(isSafeRepoRelativePath, { message: '照片路径必须是仓库内相对路径' })
  .refine((value) => value.startsWith('data/photos/'), {
    message: '照片路径必须位于 data/photos/ 下',
  })
  .refine((value) => !value.startsWith('data/photos/thumbs/'), {
    message: '主图不能位于缩略图目录',
  });

const thumbnailPathSchema = z
  .string()
  .refine(isSafeRepoRelativePath, { message: '缩略图路径必须是仓库内相对路径' })
  .refine((value) => value.startsWith('data/photos/thumbs/'), {
    message: '缩略图路径必须位于 data/photos/thumbs/ 下',
  });

export const captionSchema = z.string().superRefine((value, ctx) => {
  const trimmed = value.trim();
  const length = Array.from(trimmed).length;
  if (length < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '文案不能为空' });
  }
  if (length > MAX_CAPTION_LENGTH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `文案不能超过 ${MAX_CAPTION_LENGTH} 个字符`,
    });
  }
  if (Array.from(value).some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '文案不能包含控制字符或换行' });
  }
  if (/<[a-zA-Z!/][^>]*>/.test(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '文案不能包含 HTML 标签' });
  }
  if (/^\s*(```|#{1,6}\s|[-*+]\s)/m.test(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '文案不能包含 Markdown 结构' });
  }
});

export const capturedAtSchema = isoDateTime.refine(
  (value) => {
    const datePart = value.slice(0, 10);
    return isValidIsoDate(datePart);
  },
  { message: '拍摄时间必须包含合法日期' },
);

const baseEntrySchema = z
  .object({
    date: z.string().refine(isValidIsoDate, { message: '日期必须是合法的 YYYY-MM-DD' }),
    photo: photoPathSchema,
    thumbnail: thumbnailPathSchema,
    caption: captionSchema,
    captionSource: z.enum(['generated', 'manual']).optional(),
    captionModel: z.string().min(1).max(100).optional(),
    captionPromptVersion: z.number().int().positive().optional(),
    captionUpdatedAt: utcDateTime.optional(),
    capturedAt: capturedAtSchema.optional(),
    createdAt: utcDateTime,
    updatedAt: utcDateTime,
  })
  .passthrough();

export const entrySchema = baseEntrySchema.superRefine((entry, ctx) => {
  if (entry.capturedAt && entry.capturedAt.slice(0, 10) !== entry.date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['capturedAt'],
      message: '拍摄时间的当地日期必须与条目日期一致',
    });
  }
  if (entry.photo === entry.thumbnail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['thumbnail'],
      message: '主图与缩略图不能是同一个文件',
    });
  }
});

export const manifestSchema = z
  .object({
    version: z.literal(CURRENT_SCHEMA_VERSION),
    updatedAt: utcDateTime,
    entries: z.array(entrySchema),
  })
  .passthrough()
  .superRefine((manifest, ctx) => {
    const seen = new Set<string>();
    manifest.entries.forEach((entry, index) => {
      if (seen.has(entry.date)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, 'date'],
          message: `日期重复：${entry.date}`,
        });
      }
      seen.add(entry.date);
    });
  });

export type Entry = z.infer<typeof entrySchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type CaptionSource = NonNullable<Entry['captionSource']>;

export interface ValidationFailure {
  ok: false;
  errors: string[];
  futureVersion: boolean;
}

export interface ValidationSuccess {
  ok: true;
  manifest: Manifest;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

function zodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
}

export function validateManifest(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['数据顶层必须是一个对象'], futureVersion: false };
  }
  const version = (input as { version?: unknown }).version;
  if (
    typeof version === 'number' &&
    Number.isInteger(version) &&
    version > CURRENT_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      errors: [`数据版本 ${version} 高于当前支持的版本 ${CURRENT_SCHEMA_VERSION}，请更新客户端`],
      futureVersion: true,
    };
  }
  return parseStrict(input);
}

function parseStrict(input: unknown): ValidationResult {
  const result = manifestSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, errors: zodErrors(result.error), futureVersion: false };
  }
  return { ok: true, manifest: result.data as Manifest };
}

export interface LenientParseResult {
  manifest: Manifest;
  warnings: string[];
  futureVersion: boolean;
}

export function parseManifestLenient(input: unknown): LenientParseResult {
  const empty: Manifest = {
    version: CURRENT_SCHEMA_VERSION,
    updatedAt: '1970-01-01T00:00:00Z',
    entries: [],
  };
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { manifest: empty, warnings: ['数据顶层必须是一个对象'], futureVersion: false };
  }
  const raw = input as Record<string, unknown>;
  const version = raw.version;
  if (
    typeof version === 'number' &&
    Number.isInteger(version) &&
    version > CURRENT_SCHEMA_VERSION
  ) {
    return {
      manifest: empty,
      warnings: [`数据版本 ${version} 高于当前支持的版本 ${CURRENT_SCHEMA_VERSION}，请更新客户端`],
      futureVersion: true,
    };
  }
  if (version !== CURRENT_SCHEMA_VERSION) {
    return { manifest: empty, warnings: ['数据版本无效'], futureVersion: false };
  }
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : '';
  if (!utcDateTime.safeParse(updatedAt).success) {
    return { manifest: empty, warnings: ['数据更新时间无效'], futureVersion: false };
  }
  if (!Array.isArray(raw.entries)) {
    return { manifest: empty, warnings: ['数据条目必须是数组'], futureVersion: false };
  }

  const warnings: string[] = [];
  const byDate = new Map<string, Entry>();
  raw.entries.forEach((candidate, index) => {
    const parsed = entrySchema.safeParse(candidate);
    if (!parsed.success) {
      warnings.push(`条目 ${index + 1} 无效：${zodErrors(parsed.error).join('；')}`);
      return;
    }
    const entry = parsed.data as Entry;
    if (byDate.has(entry.date)) {
      warnings.push(`日期 ${entry.date} 重复，已保留后一条`);
    }
    byDate.set(entry.date, entry);
  });

  const entries = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  return {
    manifest: { version: CURRENT_SCHEMA_VERSION, updatedAt, entries },
    warnings,
    futureVersion: false,
  };
}

export function makeEmptyManifest(updatedAt = '1970-01-01T00:00:00Z'): Manifest {
  return { version: CURRENT_SCHEMA_VERSION, updatedAt, entries: [] };
}
