import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/target/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'openspec/**',
      '.openspec-cli/**',
      '.cargo-home/**',
      '.sysroot/**',
      '.npm-cache/**',
      '.pnpm-store/**',
      '.home/**',
      '.state/**',
      '.xdg-data/**',
      '.xdg-cache/**',
      'apps/editor/src-tauri/gen/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/src/fallback/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: '回退内容必须由日期确定性生成，不能使用 Math.random。',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'apps/web/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
