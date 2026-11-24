import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Local dev talks to the deployed backend: /api and /config.json are proxied
 * to the CloudFront URL written by `npm run deploy` into cdk-outputs.json.
 */
function deployedSiteUrl(): string | undefined {
  const file = new URL('../../cdk-outputs.json', import.meta.url);
  if (!existsSync(file)) return undefined;
  const outputs = JSON.parse(readFileSync(file, 'utf8'));
  return outputs.CommissionTracker?.SiteUrl;
}

const target = process.env.SITE_URL ?? deployedSiteUrl();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: target
      ? {
          '/api': { target, changeOrigin: true },
          '/config.json': { target, changeOrigin: true },
        }
      : undefined,
  },
});
