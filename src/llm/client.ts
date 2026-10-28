import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { getLlmConfig } from '../core/config';

const TIMEOUT_MS = 20_000;
const MAX_TOKENS = 4096;

let client: Anthropic | undefined;

// Returns the model's answer as JSON matching `schema`. Effort is low because both uses
// (reading a request, rewording a reply) are simple tasks.
export async function askForJson<T extends z.ZodType>(schema: T, system: string, content: string): Promise<z.infer<T>> {
  const { apiKey, model } = getLlmConfig();
  client ??= new Anthropic({ apiKey, timeout: TIMEOUT_MS });
  const response = await client.messages.parse({
    model,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'low', format: zodOutputFormat(schema) },
  });
  if (!response.parsed_output) {
    throw new Error(`LLM returned no structured output (stop reason: ${response.stop_reason})`);
  }
  return response.parsed_output;
}
