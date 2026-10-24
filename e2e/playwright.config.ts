import { defineConfig, devices } from '@playwright/test';

// E2E runs the REAL stack: backend (:4000, dev DB with demo seed) + frontend (:5173, VITE_USE_MOCK=false).
// reuseExistingServer lets it attach to servers a teammate already has running locally.
const FRONTEND = 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: FRONTEND, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm --prefix ../../backend run dev',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm --prefix .. run dev -- --port 5173 --strictPort',
      env: { VITE_USE_MOCK: 'false' },
      url: FRONTEND,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
