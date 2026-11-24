import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  use: { baseURL: 'http://localhost:4173/agent-plugins/' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/agent-plugins/',
    reuseExistingServer: !process.env.CI,
  },
});
