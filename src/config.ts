import 'dotenv/config';
import { z } from 'zod';

export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

const appSchema = z.object({
  HEADLESS: z.stringbool().default(true),
  LOG_LEVEL: z.enum(LogLevel).default(LogLevel.INFO),
  LOG_PRETTY: z.stringbool().default(true),
});

const emailSchema = z.object({
  GMAIL_ADDRESS: z.email(),
  GMAIL_APP_PASSWORD: z.string().min(1),
  IMAP_HOST: z.string().default('imap.gmail.com'),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  POLL_INTERVAL_MS: z.coerce.number().int().min(5_000).default(30_000),
});

const llmSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().default('claude-haiku-5-5'),
});

export interface AppConfig {
  headless: boolean;
  logLevel: LogLevel;
  prettyLogs: boolean;
}

export interface EmailConfig {
  address: string;
  appPassword: string;
  imapHost: string;
  smtpHost: string;
  pollIntervalMs: number;
}

export interface LlmConfig {
  apiKey: string;
  model: string;
}

function parseEnv<T extends z.ZodType>(schema: T, section: string): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid ${section} configuration (check .env): ${issues}`);
  }
  return result.data;
}

const appEnv = parseEnv(appSchema, 'app');

export const appConfig: AppConfig = {
  headless: appEnv.HEADLESS,
  logLevel: appEnv.LOG_LEVEL,
  prettyLogs: appEnv.LOG_PRETTY,
};

let emailConfig: EmailConfig | undefined;

export function getEmailConfig(): EmailConfig {
  if (!emailConfig) {
    const env = parseEnv(emailSchema, 'email');
    emailConfig = {
      address: env.GMAIL_ADDRESS,
      appPassword: env.GMAIL_APP_PASSWORD,
      imapHost: env.IMAP_HOST,
      smtpHost: env.SMTP_HOST,
      pollIntervalMs: env.POLL_INTERVAL_MS,
    };
  }
  return emailConfig;
}

let llmConfig: LlmConfig | undefined;

export function getLlmConfig(): LlmConfig {
  if (!llmConfig) {
    const env = parseEnv(llmSchema, 'LLM');
    llmConfig = { apiKey: env.ANTHROPIC_API_KEY, model: env.LLM_MODEL };
  }
  return llmConfig;
}
