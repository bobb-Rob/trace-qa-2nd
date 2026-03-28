/**
 * Error capture module - uncaught errors and unhandled promise rejections.
 */

import type { CaptureConfig, ErrorPayload } from '../types';
import { truncate } from '../utils/sanitization';
import { sessionRelativeTime, generateId } from '../utils/timing';

const MAX_STACK_LENGTH = 2000;

export function startErrorCapture(config: CaptureConfig): () => void {
  function handleError(e: ErrorEvent): void {
    const now = Date.now();
    const payload: ErrorPayload = {
      id: generateId(),
      message: e.message || 'Unknown error',
      name: e.error?.name || 'Error',
      stack: e.error?.stack ? truncate(e.error.stack, MAX_STACK_LENGTH) : undefined,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      errorType: 'uncaught',
    };

    config.buffer.push({
      type: 'error',
      timestamp: now,
      relativeTime: sessionRelativeTime(config.sessionStartTime),
      payload,
    });
  }

  function handleRejection(e: PromiseRejectionEvent): void {
    const now = Date.now();
    const reason = e.reason;
    const isError = reason instanceof Error;

    const payload: ErrorPayload = {
      id: generateId(),
      message: isError ? reason.message : String(reason),
      name: isError ? reason.name : 'UnhandledRejection',
      stack: isError && reason.stack ? truncate(reason.stack, MAX_STACK_LENGTH) : undefined,
      errorType: 'unhandledrejection',
    };

    config.buffer.push({
      type: 'error',
      timestamp: now,
      relativeTime: sessionRelativeTime(config.sessionStartTime),
      payload,
    });
  }

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}
