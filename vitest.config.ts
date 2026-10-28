import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Set before .env is loaded (dotenv never overrides), so tests never see real credentials.
    env: {
      LOG_LEVEL: 'fatal',
      LOG_PRETTY: 'false',
      GMAIL_ADDRESS: 'agent@example.com',
      GMAIL_APP_PASSWORD: 'test-password',
      ANTHROPIC_API_KEY: 'test-key',
      LLM_MODEL: 'test-model',
    },
  },
});
