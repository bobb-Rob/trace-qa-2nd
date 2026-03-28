/**
 * Session Consolidator
 *
 * Reads all telemetry batches for a session from IndexedDB,
 * categorizes events, builds cross-references, and produces
 * the final RecordedSession payload.
 *
 * @module background/persistence/sessionConsolidator
 */

import type { TelemetryEvent } from '../../shared/contracts/events';
import type {
  RecordedSession,
  TimelineEvent,
  InteractionEvent,
  NavigationEvent,
  NetworkRequest,
  AggregatedNetworkGroup,
  ConsoleLogEntry,
  ErrorEntry,
  VisibilityEvent,
  DOMSnapshot,
  SessionMetrics,
} from '../../shared/contracts/telemetryPayload';
import {
  getTelemetryBatches,
  storeSessionPayload,
  deleteTelemetryBatches,
} from './telemetryStore';

// ============================================
// TYPES
// ============================================

export interface ConsolidationParams {
  sessionId: string;
  startTime: number;
  tabId: number;
  captureMode: 'tab' | 'window' | 'screen';
  micEnabled: boolean;
  networkStats?: {
    droppedCount: number;
    aggregated: Map<string, { count: number; totalDuration: number; statuses: Record<number, number> }>;
  };
}

// Cross-referencing time windows (ms)
const INTERACTION_TO_NETWORK_WINDOW = 2000;
const INTERACTION_TO_NAVIGATION_WINDOW = 1000;
const ERROR_TO_INTERACTION_WINDOW = 5000;
const ERROR_TO_NETWORK_WINDOW = 2000;
const CONSOLE_TO_INTERACTION_WINDOW = 3000;

// ============================================
// HELPERS
// ============================================

function getData(event: TelemetryEvent): Record<string, unknown> {
  return (event.data as Record<string, unknown>) ?? {};
}

function getString(data: Record<string, unknown>, key: string): string {
  const val = data[key];
  return typeof val === 'string' ? val : '';
}

function getNumber(data: Record<string, unknown>, key: string): number {
  const val = data[key];
  return typeof val === 'number' ? val : 0;
}

function getOptionalString(data: Record<string, unknown>, key: string): string | undefined {
  const val = data[key];
  return typeof val === 'string' ? val : undefined;
}

// ============================================
// EVENT MAPPERS
// ============================================

function toInteraction(event: TelemetryEvent): InteractionEvent {
  const d = getData(event);
  const action = event.type as 'click' | 'input' | 'scroll';

  return {
    id: getString(d, 'id'),
    timestamp: event.timestamp,
    action,
    element: {
      tagName: getString(d, 'tagName'),
      selector: getString(d, 'selector'),
      textContent: getOptionalString(d, 'textContent'),
      ariaLabel: getOptionalString(d, 'ariaLabel'),
      role: getOptionalString(d, 'role'),
      inputType: getOptionalString(d, 'inputType'),
    },
    value: getOptionalString(d, 'value'),
    scrollPosition: action === 'scroll'
      ? { x: getNumber(d, 'scrollX'), y: getNumber(d, 'scrollY') }
      : undefined,
    pageUrl: getString(d, 'pageUrl'),
  };
}

function toNavigation(event: TelemetryEvent): NavigationEvent {
  const d = getData(event);
  return {
    id: getString(d, 'id'),
    timestamp: event.timestamp,
    fromUrl: getString(d, 'from'),
    toUrl: getString(d, 'to'),
    navigationType: getString(d, 'navigationType') as NavigationEvent['navigationType'],
  };
}

function toNetworkRequest(event: TelemetryEvent): NetworkRequest {
  const d = getData(event);
  return {
    id: getString(d, 'id'),
    timestamp: event.timestamp,
    duration: getNumber(d, 'duration') || ((d['timing'] as Record<string, unknown>)?.['duration'] as number ?? 0),
    method: getString(d, 'method'),
    url: getString(d, 'url'),
    status: getNumber(d, 'status') || undefined,
    statusText: getOptionalString(d, 'statusText'),
    success: d['success'] === true,
    error: getOptionalString(d, 'error'),
    requestHeaders: d['requestHeaders'] as Record<string, string> | undefined,
    responseHeaders: d['responseHeaders'] as Record<string, string> | undefined,
  };
}

function toConsoleLog(event: TelemetryEvent): ConsoleLogEntry {
  const d = getData(event);
  return {
    id: getString(d, 'id'),
    timestamp: event.timestamp,
    level: getString(d, 'level') as ConsoleLogEntry['level'],
    message: getString(d, 'message'),
    stack: getOptionalString(d, 'stack'),
  };
}

function toError(event: TelemetryEvent): ErrorEntry {
  const d = getData(event);
  return {
    id: getString(d, 'id'),
    timestamp: event.timestamp,
    message: getString(d, 'message'),
    stack: getOptionalString(d, 'stack'),
    source: getOptionalString(d, 'filename'),
  };
}

function toVisibility(event: TelemetryEvent): VisibilityEvent {
  const d = getData(event);
  return {
    id: getString(d, 'id'),
    timestamp: event.timestamp,
    state: getString(d, 'state') as 'visible' | 'hidden',
  };
}

function toDomSnapshot(event: TelemetryEvent): DOMSnapshot {
  const d = getData(event);
  return {
    id: getString(d, 'id'),
    timestamp: event.timestamp,
    url: getString(d, 'url'),
    importantElements: (d['importantElements'] as DOMSnapshot['importantElements']) ?? [],
  };
}

// ============================================
// CROSS-REFERENCING
// ============================================

function buildCrossReferences(
  interactions: InteractionEvent[],
  networkRequests: NetworkRequest[],
  navigationEvents: NavigationEvent[],
  consoleLogs: ConsoleLogEntry[],
  errors: ErrorEntry[],
): void {
  // Interaction → caused network requests (within 2s after)
  for (const interaction of interactions) {
    const caused: string[] = [];
    for (const req of networkRequests) {
      const delta = req.timestamp - interaction.timestamp;
      if (delta >= 0 && delta <= INTERACTION_TO_NETWORK_WINDOW) {
        caused.push(req.id);
        if (!req.triggeredByInteractionId) {
          req.triggeredByInteractionId = interaction.id;
        }
      }
    }
    if (caused.length > 0) {
      interaction.causedNetworkRequestIds = caused;
    }

    // Interaction → caused navigation (within 1s after)
    for (const nav of navigationEvents) {
      const delta = nav.timestamp - interaction.timestamp;
      if (delta >= 0 && delta <= INTERACTION_TO_NAVIGATION_WINDOW) {
        interaction.causedNavigationId = nav.id;
        break;
      }
    }
  }

  // Error → related interaction (nearest preceding within 5s)
  for (const error of errors) {
    let bestInteraction: InteractionEvent | null = null;
    let bestDelta = Infinity;

    for (const interaction of interactions) {
      const delta = error.timestamp - interaction.timestamp;
      if (delta >= 0 && delta <= ERROR_TO_INTERACTION_WINDOW && delta < bestDelta) {
        bestInteraction = interaction;
        bestDelta = delta;
      }
    }
    if (bestInteraction) {
      error.relatedInteractionId = bestInteraction.id;
    }

    // Error → related network request (nearest preceding failed within 2s)
    let bestReq: NetworkRequest | null = null;
    let bestReqDelta = Infinity;

    for (const req of networkRequests) {
      if (req.success) continue;
      const delta = error.timestamp - req.timestamp;
      if (delta >= 0 && delta <= ERROR_TO_NETWORK_WINDOW && delta < bestReqDelta) {
        bestReq = req;
        bestReqDelta = delta;
      }
    }
    if (bestReq) {
      error.relatedNetworkRequestId = bestReq.id;
    }
  }

  // Console (warn/error) → related interaction (nearest preceding within 3s)
  for (const log of consoleLogs) {
    if (log.level !== 'warn' && log.level !== 'error') continue;

    let bestInteraction: InteractionEvent | null = null;
    let bestDelta = Infinity;

    for (const interaction of interactions) {
      const delta = log.timestamp - interaction.timestamp;
      if (delta >= 0 && delta <= CONSOLE_TO_INTERACTION_WINDOW && delta < bestDelta) {
        bestInteraction = interaction;
        bestDelta = delta;
      }
    }
    if (bestInteraction) {
      log.relatedInteractionId = bestInteraction.id;
    }
  }
}

// ============================================
// TIMELINE BUILDER
// ============================================

function buildTimeline(
  interactions: InteractionEvent[],
  navigationEvents: NavigationEvent[],
  networkRequests: NetworkRequest[],
  consoleLogs: ConsoleLogEntry[],
  errors: ErrorEntry[],
  visibilityEvents: VisibilityEvent[],
  domSnapshots: DOMSnapshot[],
): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];

  for (const e of interactions) timeline.push({ type: 'interaction', refId: e.id, timestamp: e.timestamp });
  for (const e of navigationEvents) timeline.push({ type: 'navigation', refId: e.id, timestamp: e.timestamp });
  for (const e of networkRequests) timeline.push({ type: 'network', refId: e.id, timestamp: e.timestamp });
  for (const e of consoleLogs) timeline.push({ type: 'console', refId: e.id, timestamp: e.timestamp });
  for (const e of errors) timeline.push({ type: 'error', refId: e.id, timestamp: e.timestamp });
  for (const e of visibilityEvents) timeline.push({ type: 'visibility', refId: e.id, timestamp: e.timestamp });
  for (const e of domSnapshots) timeline.push({ type: 'snapshot', refId: e.id, timestamp: e.timestamp });

  timeline.sort((a, b) => a.timestamp - b.timestamp);
  return timeline;
}

// ============================================
// METRICS
// ============================================

function computeMetrics(
  interactions: InteractionEvent[],
  networkRequests: NetworkRequest[],
  consoleLogs: ConsoleLogEntry[],
  errors: ErrorEntry[],
  navigationEvents: NavigationEvent[],
  visibilityEvents: VisibilityEvent[],
  domSnapshots: DOMSnapshot[],
  droppedNetworkCount: number,
): SessionMetrics {
  return {
    totalInteractions: interactions.length,
    totalNetworkRequests: networkRequests.length + droppedNetworkCount,
    failedNetworkRequests: networkRequests.filter((r) => !r.success).length,
    totalConsoleLogs: consoleLogs.length,
    consoleErrorCount: consoleLogs.filter((l) => l.level === 'error').length,
    totalErrors: errors.length,
    totalNavigations: navigationEvents.length,
    totalVisibilityChanges: visibilityEvents.length,
    totalSnapshots: domSnapshots.length,
    wasBackgroundRestarted: false,
  };
}

// ============================================
// HELPERS
// ============================================

async function getViewportFromTab(tabId: number): Promise<{ width: number; height: number }> {
  try {
    if (!tabId) return { width: 0, height: 0 };
    const tab = await chrome.tabs.get(tabId);
    return {
      width: tab.width ?? 0,
      height: tab.height ?? 0,
    };
  } catch {
    return { width: 0, height: 0 };
  }
}

// ============================================
// MAIN CONSOLIDATION
// ============================================

export async function consolidateSession(params: ConsolidationParams): Promise<RecordedSession> {
  const batches = await getTelemetryBatches(params.sessionId);

  // 1. Flatten and sort all events
  const allEvents: TelemetryEvent[] = [];
  for (const batch of batches) {
    allEvents.push(...batch.events);
  }
  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  // 2. Categorize into buckets
  const interactions: InteractionEvent[] = [];
  const navigationEvents: NavigationEvent[] = [];
  const networkRequests: NetworkRequest[] = [];
  const consoleLogs: ConsoleLogEntry[] = [];
  const errors: ErrorEntry[] = [];
  const visibilityEvents: VisibilityEvent[] = [];
  const domSnapshots: DOMSnapshot[] = [];

  for (const event of allEvents) {
    switch (event.type) {
      case 'click':
      case 'input':
      case 'scroll':
        interactions.push(toInteraction(event));
        break;
      case 'navigation':
        navigationEvents.push(toNavigation(event));
        break;
      case 'network':
        networkRequests.push(toNetworkRequest(event));
        break;
      case 'console':
        consoleLogs.push(toConsoleLog(event));
        break;
      case 'error':
        errors.push(toError(event));
        break;
      case 'visibility':
        visibilityEvents.push(toVisibility(event));
        break;
      case 'domSnapshot':
        domSnapshots.push(toDomSnapshot(event));
        break;
    }
  }

  // 3. Cross-reference pass
  buildCrossReferences(interactions, networkRequests, navigationEvents, consoleLogs, errors);

  // 4. Network tiering
  const aggregatedBackground: AggregatedNetworkGroup[] = [];
  let droppedCount = 0;

  if (params.networkStats) {
    droppedCount = params.networkStats.droppedCount;
    for (const [pattern, acc] of params.networkStats.aggregated.entries()) {
      aggregatedBackground.push({
        pattern,
        count: acc.count,
        avgDuration: acc.count > 0 ? acc.totalDuration / acc.count : 0,
        statuses: acc.statuses,
      });
    }
  }

  // 5. Build timeline
  const timeline = buildTimeline(
    interactions, navigationEvents, networkRequests,
    consoleLogs, errors, visibilityEvents, domSnapshots,
  );

  // 6. Compute metadata
  const endTime = allEvents.length > 0
    ? allEvents[allEvents.length - 1].timestamp
    : Date.now();

  const urlAtStart = batches.length > 0 ? batches[0].metadata.url : '';
  const urlAtEnd = batches.length > 0 ? batches[batches.length - 1].metadata.url : urlAtStart;

  // 7. Compute metrics
  const metrics = computeMetrics(
    interactions, networkRequests, consoleLogs, errors,
    navigationEvents, visibilityEvents, domSnapshots, droppedCount,
  );

  // 8. Build RecordedSession
  const session: RecordedSession = {
    sessionId: params.sessionId,
    tabId: params.tabId,
    startTime: params.startTime,
    endTime,
    duration: endTime - params.startTime,
    urlAtStart,
    urlAtEnd,
    browserContext: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      viewport: await getViewportFromTab(params.tabId),
    },
    recordingContext: {
      captureMode: params.captureMode,
      micEnabled: params.micEnabled,
      videoQuality: 'medium',
    },
    timeline,
    interactions,
    navigationEvents,
    network: {
      important: networkRequests,
      aggregatedBackground,
      droppedCount,
    },
    consoleLogs,
    errors,
    visibilityEvents,
    domSnapshots,
    metrics,
    analysis: {
      status: 'pending',
      analysisId: `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      requestedAt: Date.now(),
    },
    version: {
      extensionVersion: chrome.runtime.getManifest().version,
      telemetrySchemaVersion: '1.0',
    },
  };

  // 9. Store and cleanup
  await storeSessionPayload(session);
  await deleteTelemetryBatches(params.sessionId);

  console.log('[SessionConsolidator] Session consolidated:', params.sessionId, {
    interactions: interactions.length,
    network: networkRequests.length,
    console: consoleLogs.length,
    errors: errors.length,
    timeline: timeline.length,
  });
  console.log('[SessionConsolidator] Full RecordedSession:', JSON.parse(JSON.stringify(session)));

  return session;
}
