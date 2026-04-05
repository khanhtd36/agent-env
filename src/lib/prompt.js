import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export async function withPrompter(fn) {
  const rl = readline.createInterface({ input, output });
  try {
    return await fn({
      text: (message) => rl.question(message),
      close: () => rl.close(),
    });
  } finally {
    rl.close();
  }
}

export function normalizeYesNo(value, fallback = false) {
  const trimmed = String(value ?? '').trim().toLowerCase();
  if (!trimmed) return fallback;
  return ['y', 'yes', 'true', '1'].includes(trimmed);
}
