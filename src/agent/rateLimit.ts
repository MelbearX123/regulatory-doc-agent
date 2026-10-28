const WINDOW_MS = 60 * 60 * 1000;
const MAX_REPLIES_PER_WINDOW = 5;

// Stops a badly behaved bot that sets no auto-reply headers from ping-ponging with the agent forever.
export function createRateLimiter(): (sender: string, now?: number) => boolean {
  const repliesBySender = new Map<string, number[]>();
  return (sender, now = Date.now()) => {
    const key = sender.toLowerCase();
    const recent = (repliesBySender.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
    const allowed = recent.length < MAX_REPLIES_PER_WINDOW;
    repliesBySender.set(key, allowed ? [...recent, now] : recent);
    return allowed;
  };
}
