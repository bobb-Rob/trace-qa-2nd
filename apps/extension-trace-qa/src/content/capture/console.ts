/**
 * Console log capture module.
 * Intercepts console.log/warn/error/info/debug and records entries.
 */

import type { CaptureConfig, ConsolePayload } from '../types';
import { sessionRelativeTime, generateId } from '../utils/timing';
import { truncate } from '../utils/sanitization';

type ConsoleLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

const LEVELS: ConsoleLevel[] = ['log', 'warn', 'error', 'info', 'debug'];
const MAX_MESSAGE_LENGTH = 2000;
const MAX_STACK_LENGTH = 2000;

// Internal log prefixes to filter out — these are TraceQA's own logs,
// not the user's application output.
const INTERNAL_PREFIXES = [
  '[Telemetry]',
  '[ContentScript]',
  '[SessionConsolidator]',
  '[TelemetryController]',
  '[TelemetryStore]',
  '[FloatingPane',
  '[TraceQA',
];

export function startConsoleCapture(config: CaptureConfig): () => void {
  let isCapturing = false;

  // Save original methods
  const originals: Record<ConsoleLevel, (...args: unknown[]) => void> = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  function serializeArgs(args: unknown[]): string {
    const parts = args.map((arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    });
    return truncate(parts.join(' '), MAX_MESSAGE_LENGTH);
  }

  function createWrapper(level: ConsoleLevel): (...args: unknown[]) => void {
    return function (this: Console, ...args: unknown[]): void {
      // Call original first to preserve output
      originals[level].apply(this, args);

      // Guard against recursion
      if (isCapturing) return;
      isCapturing = true;

      try {
        const now = Date.now();
        const message = serializeArgs(args);

        // Skip internal TraceQA logs — only capture the user's application output
        if (INTERNAL_PREFIXES.some((prefix) => message.startsWith(prefix))) {
          return;
        }

        // Capture stack trace for error level
        let stack: string | undefined;
        if (level === 'error') {
          const err = new Error();
          if (err.stack) {
            // Remove the first two lines (Error + this wrapper frame)
            const lines = err.stack.split('\n');
            stack = truncate(lines.slice(2).join('\n'), MAX_STACK_LENGTH);
          }
        }

        const payload: ConsolePayload = {
          id: generateId(),
          level,
          message,
          stack,
        };

        config.buffer.push({
          type: 'console',
          timestamp: now,
          relativeTime: sessionRelativeTime(config.sessionStartTime),
          payload,
        });
      } finally {
        isCapturing = false;
      }
    };
  }

  // Install wrappers
  for (const level of LEVELS) {
    console[level] = createWrapper(level);
  }

  return () => {
    // Restore originals
    for (const level of LEVELS) {
      console[level] = originals[level];
    }
  };
}
