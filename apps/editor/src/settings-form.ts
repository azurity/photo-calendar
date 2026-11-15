import type { Settings } from './api';

export function validateSettings(settings: Settings): string[] {
  const errors: string[] = [];
  const httpUrl = (value: string): boolean => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };
  if (!httpUrl(settings.deepseek.baseUrl)) {
    errors.push('DeepSeek API Base URL 必须是 http/https 地址');
  }
  if (!settings.deepseek.model.trim()) errors.push('模型名不能为空');

  const remote = settings.git.remoteUrl.trim();
  if (remote) {
    if (remote.includes('@') && remote.startsWith('http')) {
      errors.push('仓库地址不能包含明文凭据');
    } else if (!/^(https:\/\/|ssh:\/\/|git@)/.test(remote)) {
      errors.push('仓库地址必须是 HTTPS 或 SSH 形式');
    }
  }
  const branch = settings.git.branch.trim();
  if (
    !branch ||
    branch.startsWith('-') ||
    branch.includes('..') ||
    branch.includes('//') ||
    /\s/.test(branch)
  ) {
    errors.push('分支名不合法');
  }
  const worktree = settings.git.worktreePath.trim();
  if (!worktree || !(worktree.startsWith('/') || /^[A-Za-z]:[\\/]/.test(worktree))) {
    errors.push('工作副本必须是绝对路径');
  }
  if (settings.git.siteUrl.trim() && !httpUrl(settings.git.siteUrl)) {
    errors.push('线上站点地址必须是 http/https 地址');
  }
  return errors;
}
