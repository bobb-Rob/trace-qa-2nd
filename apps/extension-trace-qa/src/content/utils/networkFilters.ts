/**
 * Network request capture-time filters.
 * Implements Layer 1 hard filters to reduce noise.
 */

// ============================================
// TYPES
// ============================================

export interface RawNetworkEntry {
  url: string;
  method: string;
  status: number;
  contentType: string;
  initiatorType: string;
  duration: number;
  error?: string;
}

export type FilterDecision = 'keep' | 'aggregate' | 'drop';

// ============================================
// CONSTANTS
// ============================================

const DROPPED_INITIATOR_TYPES = new Set([
  'img', 'image',
  'font',
  'css', 'stylesheet',
  'media', 'audio', 'video',
  'manifest',
  'beacon',
  'ping',
]);

const ANALYTICS_URL_PATTERNS = [
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /analytics\./i,
  /hotjar\.com/i,
  /segment\.io/i,
  /mixpanel\.com/i,
  /sentry\.io\/api/i,
  /datadog/i,
  /newrelic/i,
];

const FAVICON_PATTERN = /favicon\.(ico|png|svg)/i;

// ============================================
// FILTER LOGIC
// ============================================

/**
 * Determine whether a network request should be kept, aggregated, or dropped.
 */
export function shouldKeepRequest(entry: RawNetworkEntry): FilterDecision {
  // B. Status-based: always keep errors
  if (entry.error) return 'keep';
  if (entry.status >= 400) return 'keep';
  if (entry.status === 0) return 'keep'; // network error / aborted

  // A. Resource type: drop noise
  if (DROPPED_INITIATOR_TYPES.has(entry.initiatorType)) return 'aggregate';
  if (FAVICON_PATTERN.test(entry.url)) return 'aggregate';
  for (const pattern of ANALYTICS_URL_PATTERNS) {
    if (pattern.test(entry.url)) return 'drop';
  }

  // C. Duration threshold: drop ultra-fast cache hits
  if (entry.duration < 5 && entry.status === 200) return 'aggregate';

  // D. Method: keep non-GET
  if (entry.method !== 'GET') return 'keep';

  // E. Content-type: keep JSON/API responses
  if (entry.contentType.includes('application/json')) return 'keep';
  if (entry.contentType.includes('application/graphql')) return 'keep';

  // F. URL pattern: keep API calls
  if (/\/api\//i.test(entry.url)) return 'keep';
  if (/\/graphql/i.test(entry.url)) return 'keep';

  // Default: aggregate (background noise like scripts, documents)
  return 'aggregate';
}

/**
 * Generate a grouping key for aggregated network requests.
 * Replaces path segments that look like IDs with wildcards.
 */
export function aggregateKey(url: string, method: string): string {
  try {
    const parsed = new URL(url);
    // Replace UUID-like and numeric path segments with *
    const path = parsed.pathname.replace(
      /\/[0-9a-f]{8,}(?:-[0-9a-f]{4,}){0,4}/gi,
      '/*'
    ).replace(
      /\/\d+/g,
      '/*'
    );
    return `${method} ${parsed.hostname}${path}`;
  } catch {
    return `${method} ${url.substring(0, 100)}`;
  }
}
