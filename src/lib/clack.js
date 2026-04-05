import { isCancel, cancel } from '@clack/prompts';

/**
 * Wrap a clack prompt result — throw on Ctrl+C, return value otherwise.
 */
export function unwrap(result, message = 'Cancelled.') {
  if (isCancel(result)) {
    cancel(message);
    process.exit(0);
  }
  return result;
}
