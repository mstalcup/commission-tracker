/** Runtime config written by CDK into the site bucket as /config.json. */
export interface AppConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  cognitoDomain: string;
  googleEnabled: boolean;
}

let cached: AppConfig | undefined;

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached;
  const res = await fetch('/config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load /config.json. Has the app been deployed (npm run deploy)?');
  cached = (await res.json()) as AppConfig;
  return cached;
}
