import { describe, expect, it } from 'vitest';
import { needsSetup, missingSetupItems } from './setup';
import type { Settings } from './api';

const settings: Settings = {
  version: 1,
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  git: {
    remoteUrl: '',
    branch: 'main',
    worktreePath: '/tmp/site',
    autoPublish: true,
    siteUrl: '',
  },
};

describe('setup state', () => {
  it('reports missing key and repository', () => {
    expect(
      missingSetupItems(settings, { configured: false, persistent: false, masked: '' }),
    ).toEqual(['DeepSeek API Key', '站点仓库']);
    expect(needsSetup(settings, null)).toBe(true);
  });

  it('allows import before setup to proceed without a banner', () => {
    const configured = {
      ...settings,
      git: { ...settings.git, remoteUrl: 'https://example.com/x.git' },
    };
    expect(needsSetup(configured, { configured: true, persistent: true, masked: '••••1234' })).toBe(
      false,
    );
  });
});
