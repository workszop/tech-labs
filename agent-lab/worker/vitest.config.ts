import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export const TEST_PROVIDER_KEY = 'sk-test-SUPERSECRET-provider-key-1234567890'
export const TEST_ADMIN_TOKEN = 'test-admin-token-0123456789abcdef'

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'))
  return {
    plugins: [
      cloudflareTest({
        main: './src/index.ts',
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          // Test bindings override wrangler.jsonc vars (and any local .dev.vars).
          bindings: {
            TEST_MIGRATIONS: migrations,
            PROVIDER: 'mock',
            PROVIDER_API_KEY: TEST_PROVIDER_KEY,
            CODE_PEPPER: 'test-pepper-0123456789abcdef0123456789',
            ADMIN_TOKEN: TEST_ADMIN_TOKEN,
            ALLOWED_ORIGINS: 'http://localhost:5173,https://workszop.github.io',
            ACCESS_TEAM_DOMAIN: '',
            ACCESS_AUD: '',
            MOCK_STREAM_DELAY_MS: '0',
            ACTIVATION_MIN_RESPONSE_MS: '0',
            ACTIVATION_MAX_ATTEMPTS: '10',
            ACTIVATION_GLOBAL_FAILURES_PER_MINUTE: '100000',
            RATE_LIMIT_PER_MINUTE: '30',
          },
        },
      }),
    ],
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      testTimeout: 20_000,
    },
  }
})
