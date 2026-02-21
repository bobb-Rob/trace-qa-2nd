/**
 * Timing and ID utilities for telemetry.
 */

/**
 * Generate a short random ID (9-char alphanumeric).
 * Matches the existing codebase pattern.
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Get milliseconds elapsed since session start.
 */
export function sessionRelativeTime(sessionStartTime: number): number {
  return Date.now() - sessionStartTime;
}
