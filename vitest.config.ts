import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Set before .env is loaded (dotenv never overrides), so tests never see real credentials.
    env: {
      LOG_LEVEL: 'fatal',
      LOG_PRETTY: 'false',
      GMAIL_ADDRESS: 'agent@example.com',
      GMAIL_APP_PASSWORD: 'test-password',
    },
  },
});
