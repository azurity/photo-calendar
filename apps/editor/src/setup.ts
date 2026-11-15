import type { SecretStatus, Settings } from './api';

export function missingSetupItems(
  settings: Settings | null,
  secret: SecretStatus | null,
): string[] {
  const missing: string[] = [];
  if (!secret?.configured) missing.push('DeepSeek API Key');
  if (!settings?.git.remoteUrl) missing.push('站点仓库');
  return missing;
}

export function needsSetup(settings: Settings | null, secret: SecretStatus | null): boolean {
  return missingSetupItems(settings, secret).length > 0;
}
