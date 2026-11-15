# @photo-calendar/shared

展示端与编辑器共享的纯 TypeScript 契约：

- `date.ts`：严格的 `YYYY-MM-DD` / `YYYY-MM` 解析、月矩阵、星期与日期加减，避免 `new Date('YYYY-MM-DD')` 的 UTC 解析陷阱。
- `seed.ts`：FNV-1a 哈希与按 `日期 + 域` 的确定性选择，供无照片回退内容使用。
- `schema.ts`：`data/calendar.json` 的 zod 校验、路径检查、文案限制与宽松解析。

## 命令

```bash
pnpm --filter @photo-calendar/shared test
pnpm --filter @photo-calendar/shared typecheck
```

`fixtures/` 同时被 TypeScript 测试与 Rust 数据层测试使用，修改契约时必须同步更新 `docs/data-contract.md`。
