/**
 * Network request capture module.
 *
 * Architecture:
 * - Main World Script (main-world.ts): Declared in manifest.json with
 *   "world": "MAIN", "run_at": "document_start". Patches the page's real
 *   fetch() and XMLHttpRequest BEFORE any page JS loads. Bypasses CSP
 *   because Chrome injects it directly (not via inline <script> tag).
 *   Sends captured data via window.postMessage(__TRACEQA_NET__).
 *
 * - This module (content script): Sends __TRACEQA_CTRL__ to activate the
 *   main world script, listens for __TRACEQA_NET__ messages, applies
 *   3-layer capture-time filtering, enriches with PerformanceObserver
 *   timing, and pushes kept events to the telemetry buffer.
 *
 * - PerformanceObserver: Runs in the content script to add detailed
 *   timing breakdown (DNS, TCP, TLS, TTFB, etc.) to captured requests.
 */

import type { CaptureConfig, NetworkPayload } from '../types';
import { sessionRelativeTime, generateId } from '../utils/timing';
import { sanitizeUrl } from '../utils/sanitization';
import {
  shouldKeepRequest,
  aggregateKey,
  type RawNetworkEntry,
} from '../utils/networkFilters';

// ============================================
// TYPES
// ============================================

/** Data sent from the main world script via postMessage */
interface MainWorldNetworkEvent {
  id: string;
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  status: number;
  statusText: string;
  contentType: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBodySize: number;
  responseBodySize: number;
  hasAuth: boolean;
  error?: string;
  initiatorType: 'fetch' | 'xmlhttprequest';
}

export interface AggregateAccumulator {
  count: number;
  totalDuration: number;
  statuses: Record<number, number>;
}

interface NetworkStats {
  droppedCount: number;
  aggregated: Map<string, AggregateAccumulator>;
}

// ============================================
// CONSTANTS
// ============================================

const NET_MSG_TYPE = '__TRACEQA_NET__';

// Timing correlation window (ms) for matching PerformanceObserver entries
const PERF_CORRELATION_WINDOW_MS = 2000;

// ============================================
// MODULE STATE
// ============================================

let moduleStats: NetworkStats | null = null;

/**
 * Get network stats for consolidation. Called by sessionManager on deactivate.
 */
export function getNetworkStats(): NetworkStats | null {
  return moduleStats;
}

// ============================================
// CAPTURE
// ============================================

export function startNetworkCapture(config: CaptureConfig): () => void {
  const stats: NetworkStats = { droppedCount: 0, aggregated: new Map() };
  moduleStats = stats;

  // Track PerformanceObserver entries for timing enrichment
  const perfTimingCache = new Map<string, NetworkPayload['timing']>();

  // Main world activation is handled by sessionManager.ts at the session level.

  // ─── PerformanceObserver for timing enrichment ───

  let observer: PerformanceObserver | null = null;

  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resEntry = entry as PerformanceResourceTiming;
        const timing: NetworkPayload['timing'] = {
          startTime: performance.timeOrigin + resEntry.startTime,
          duration: resEntry.duration,
          dnsLookup: resEntry.domainLookupEnd - resEntry.domainLookupStart,
          tcpConnect: resEntry.connectEnd - resEntry.connectStart,
          tlsHandshake: resEntry.secureConnectionStart > 0
            ? resEntry.connectEnd - resEntry.secureConnectionStart
            : 0,
          ttfb: resEntry.responseStart - resEntry.requestStart,
          contentDownload: resEntry.responseEnd - resEntry.responseStart,
          blocked: resEntry.requestStart > 0
            ? resEntry.requestStart - resEntry.startTime
            : 0,
        };

        perfTimingCache.set(resEntry.name, timing);

        // Evict old entries after 10s to prevent memory leak
        setTimeout(() => {
          perfTimingCache.delete(resEntry.name);
        }, 10000);
      }
    });

    observer.observe({ type: 'resource', buffered: false });
  } catch {
    // PerformanceObserver not available
  }

  // ─── Message handler: receive data from main world ───

  function handleMessage(event: MessageEvent): void {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== NET_MSG_TYPE) return;

    const data = event.data.payload as MainWorldNetworkEvent;
    if (!data || !data.url) return;

    const duration = data.endTime - data.startTime;

    // Apply capture-time filtering
    const filterEntry: RawNetworkEntry = {
      url: data.url,
      method: data.method,
      status: data.status,
      contentType: data.contentType,
      initiatorType: data.initiatorType,
      duration,
      error: data.error,
    };

    const decision = shouldKeepRequest(filterEntry);

    if (decision === 'drop') {
      stats.droppedCount++;
      return;
    }

    if (decision === 'aggregate') {
      const key = aggregateKey(data.url, data.method);
      const existing = stats.aggregated.get(key);
      if (existing) {
        existing.count++;
        existing.totalDuration += duration;
        existing.statuses[data.status] = (existing.statuses[data.status] ?? 0) + 1;
      } else {
        stats.aggregated.set(key, {
          count: 1,
          totalDuration: duration,
          statuses: { [data.status]: 1 },
        });
      }
      stats.droppedCount++;
      return;
    }

    // 'keep' — try to enrich with PerformanceObserver timing
    let timing: NetworkPayload['timing'];
    const perfTiming = perfTimingCache.get(data.url);
    if (perfTiming && Math.abs(perfTiming.startTime - data.startTime) < PERF_CORRELATION_WINDOW_MS) {
      timing = perfTiming;
      perfTimingCache.delete(data.url);
    } else {
      timing = {
        startTime: data.startTime,
        duration,
        dnsLookup: 0,
        tcpConnect: 0,
        tlsHandshake: 0,
        ttfb: 0,
        contentDownload: 0,
        blocked: 0,
      };
    }

    const isFromCache = timing.duration < 5 && data.status === 200;

    const payload: NetworkPayload = {
      id: generateId(),
      url: sanitizeUrl(data.url),
      method: data.method,
      status: data.status,
      statusText: data.statusText,
      requestHeaders: data.requestHeaders,
      responseHeaders: data.responseHeaders,
      requestBodySize: data.requestBodySize,
      responseBodySize: data.responseBodySize,
      contentType: data.contentType,
      initiatorType: data.initiatorType,
      timing,
      error: data.error,
      isFromCache,
      hasAuth: data.hasAuth,
      success: !data.error && data.status >= 200 && data.status < 400,
    };

    config.buffer.push({
      type: 'network',
      timestamp: Date.now(),
      relativeTime: sessionRelativeTime(config.sessionStartTime),
      payload,
    });
  }

  window.addEventListener('message', handleMessage);

  // ─── Cleanup ───

  return () => {
    window.removeEventListener('message', handleMessage);

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    perfTimingCache.clear();
  };
}
