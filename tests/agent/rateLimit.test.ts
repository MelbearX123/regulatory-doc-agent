import { describe, expect, it } from 'vitest';
import { MAX_REPLIES_PER_WINDOW, createRateLimiter } from '../../src/agent/rateLimit';

const HOUR = 60 * 60 * 1000;

function useUpLimit(allowReply: (sender: string, now?: number) => boolean, sender: string): void {
  for (let i = 0; i < MAX_REPLIES_PER_WINDOW; i++) allowReply(sender, 0);
}

describe('createRateLimiter', () => {
  it('allows 10 replies per sender per hour, ignoring case', () => {
    const allowReply = createRateLimiter();
    const senders = Array.from({ length: MAX_REPLIES_PER_WINDOW + 1 }, (_, i) => (i % 2 ? 'Bob@X.com' : 'bob@x.com'));
    const results = senders.map((sender) => allowReply(sender, 0));
    expect(MAX_REPLIES_PER_WINDOW).toBe(10);
    expect(results.filter(Boolean)).toHaveLength(MAX_REPLIES_PER_WINDOW);
    expect(results.at(-1)).toBe(false);
  });

  it('counts each sender separately', () => {
    const allowReply = createRateLimiter();
    useUpLimit(allowReply, 'bob@x.com');
    expect(allowReply('alice@x.com', 0)).toBe(true);
  });

  it('allows the sender again once the hour has passed', () => {
    const allowReply = createRateLimiter();
    useUpLimit(allowReply, 'bob@x.com');
    expect(allowReply('bob@x.com', HOUR - 1)).toBe(false);
    expect(allowReply('bob@x.com', HOUR)).toBe(true);
  });
});
