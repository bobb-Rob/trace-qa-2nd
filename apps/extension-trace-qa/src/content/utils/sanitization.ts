/**
 * PII sanitization for telemetry data.
 */

const SENSITIVE_TYPES = ['password'];
const SENSITIVE_NAME_PATTERN = /password|secret|token|credit|ssn|card/i;
const SENSITIVE_AUTOCOMPLETE = [
  'current-password',
  'new-password',
  'cc-number',
  'cc-csc',
  'cc-exp',
];
const REDACTED = '[REDACTED]';
const SENSITIVE_QUERY_PARAMS = ['token', 'key', 'secret', 'password'];

/**
 * Check if a form element contains sensitive data.
 */
export function isSensitiveField(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
): boolean {
  if (element instanceof HTMLInputElement) {
    if (SENSITIVE_TYPES.includes(element.type)) return true;
  }

  const name = element.name || '';
  const id = element.id || '';
  const placeholder = (element as HTMLInputElement).placeholder || '';
  if (SENSITIVE_NAME_PATTERN.test(name) || SENSITIVE_NAME_PATTERN.test(id) || SENSITIVE_NAME_PATTERN.test(placeholder)) {
    return true;
  }

  const autocomplete = element.getAttribute('autocomplete') || '';
  if (SENSITIVE_AUTOCOMPLETE.includes(autocomplete)) return true;

  return false;
}

/**
 * Sanitize an input value, redacting sensitive fields.
 */
export function sanitizeInputValue(
  value: string,
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
): string {
  if (isSensitiveField(element)) return REDACTED;
  return truncate(value, 500);
}

/**
 * Strip sensitive query parameters from a URL.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of SENSITIVE_QUERY_PARAMS) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Truncate a string to maxLength, appending ellipsis if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
