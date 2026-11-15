import { describe, expect, it } from 'vitest';
import type { Settings } from './api';
import { validateSettings } from './settings-form';

function settings(): Settings {
  return {
    version: 1,
    deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
    git: {
      remoteUrl: 'https://github.com/example/photo-calendar.git',
      branch: 'main',
      worktreePath: '/home/user/photo-calendar',
      autoPublish: true,
      siteUrl: '',
    },
  };
}

describe('validateSettings', () => {
  it('accepts a valid configuration', () => {
    expect(validateSettings(settings())).toEqual([]);
  });

  it('rejects invalid URLs, models and branches', () => {
    const value = settings();
    value.deepseek.baseUrl = 'not-a-url';
    value.deepseek.model = ' ';
    value.git.branch = 'bad branch';
    expect(validateSettings(value)).toHaveLength(3);
  });

  it('rejects relative worktrees and credential URLs', () => {
    const value = settings();
    value.git.worktreePath = './site';
    value.git.remoteUrl = 'https://user:token@example.com/repo.git';
    const errors = validateSettings(value);
    expect(errors).toContain('工作副本必须是绝对路径');
    expect(errors).toContain('仓库地址不能包含明文凭据');
  });

  it('accepts Windows absolute worktrees', () => {
    const value = settings();
    value.git.worktreePath = 'C:\\Users\\me\\site';
    expect(validateSettings(value)).toEqual([]);
  });
});
