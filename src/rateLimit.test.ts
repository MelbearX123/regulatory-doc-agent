import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

const HOUR = 60 * 60 * 1000;

describe('createRateLimiter', () => {
  it('allows 5 replies per sender per hour, ignoring case', () => {
    const allowReply = createRateLimiter();
    const results = ['bob@x.com', 'Bob@X.com', 'bob@x.com', 'BOB@x.com', 'bob@x.com', 'bob@x.com'].map((sender) =>
      allowReply(sender, 0),
    );
    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it('counts each sender separately', () => {
    const allowReply = createRateLimiter();
    for (let i = 0; i < 5; i++) allowReply('bob@x.com', 0);
    expect(allowReply('alice@x.com', 0)).toBe(true);
  });

  it('allows the sender again once the hour has passed', () => {
    const allowReply = createRateLimiter();
    for (let i = 0; i < 5; i++) allowReply('bob@x.com', 0);
    expect(allowReply('bob@x.com', HOUR - 1)).toBe(false);
    expect(allowReply('bob@x.com', HOUR)).toBe(true);
  });
});
