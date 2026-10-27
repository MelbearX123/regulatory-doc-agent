import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { askForJson } from './client';

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { parse };
  },
}));

const schema = z.object({ answer: z.string() });

describe('askForJson', () => {
  beforeEach(() => {
    parse.mockReset();
  });

  it('returns the parsed answer from a low-effort request to the configured model', async () => {
    parse.mockResolvedValue({ parsed_output: { answer: 'yes' }, stop_reason: 'end_turn' });

    expect(await askForJson(schema, 'system prompt', 'question')).toEqual({ answer: 'yes' });
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        system: 'system prompt',
        messages: [{ role: 'user', content: 'question' }],
        output_config: expect.objectContaining({ effort: 'low' }),
      }),
    );
  });

  it('throws when the model returns no structured output', async () => {
    parse.mockResolvedValue({ parsed_output: null, stop_reason: 'refusal' });
    await expect(askForJson(schema, 'system prompt', 'question')).rejects.toThrow('stop reason: refusal');
  });
});
