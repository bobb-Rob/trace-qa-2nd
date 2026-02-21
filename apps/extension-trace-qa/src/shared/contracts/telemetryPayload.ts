/**
 * Telemetry Payload Types
 *
 * Defines the RecordedSession structure and all sub-types
 * for the consolidated telemetry payload sent to the API.
 *
 * @module contracts/telemetryPayload
 */

// ============================================
// RECORDED SESSION (top-level payload)
// ============================================

export interface RecordedSession {
  sessionId: string;
  tabId: number;

  startTime: number;
  endTime: number;
  duration: number;

  urlAtStart: string;
  urlAtEnd: string;

  browserContext: {
    userAgent: string;
    platform: string;
    viewport: {
      width: number;
      height: number;
    };
  };

  recordingContext: {
    captureMode: 'tab' | 'window' | 'screen';
    micEnabled: boolean;
    videoQuality: 'low' | 'medium' | 'high';
  };

  timeline: TimelineEvent[];

  interactions: InteractionEvent[];
  navigationEvents: NavigationEvent[];
  network: {
    important: NetworkRequest[];
    aggregatedBackground: AggregatedNetworkGroup[];
    droppedCount: number;
  };

  consoleLogs: ConsoleLogEntry[];
  errors: ErrorEntry[];
  visibilityEvents: VisibilityEvent[];
  domSnapshots: DOMSnapshot[];

  metrics: SessionMetrics;

  analysis: {
    status: 'pending';
    analysisId: string;
    requestedAt: number;
  };

  version: {
    extensionVersion: string;
    telemetrySchemaVersion: string;
  };
}

// ============================================
// TIMELINE
// ============================================

export type TimelineEvent =
  | { type: 'interaction'; refId: string; timestamp: number }
  | { type: 'navigation'; refId: string; timestamp: number }
  | { type: 'network'; refId: string; timestamp: number }
  | { type: 'console'; refId: string; timestamp: number }
  | { type: 'error'; refId: string; timestamp: number }
  | { type: 'visibility'; refId: string; timestamp: number }
  | { type: 'snapshot'; refId: string; timestamp: number };

// ============================================
// INTERACTIONS (click, input, scroll)
// ============================================

export interface InteractionEvent {
  id: string;
  timestamp: number;

  action: 'click' | 'input' | 'scroll';

  element: {
    tagName: string;
    selector: string;
    textContent?: string;
    ariaLabel?: string;
    role?: string;
    inputType?: string;
  };

  value?: string;
  scrollPosition?: { x: number; y: number };

  pageUrl: string;

  causedNetworkRequestIds?: string[];
  causedNavigationId?: string;
}

// ============================================
// NAVIGATION
// ============================================

export interface NavigationEvent {
  id: string;
  timestamp: number;

  fromUrl: string;
  toUrl: string;
  navigationType: 'reload' | 'pushState' | 'replaceState' | 'hashchange';
}

// ============================================
// NETWORK
// ============================================

export interface NetworkRequest {
  id: string;
  timestamp: number;
  duration: number;

  method: string;
  url: string;
  status?: number;
  statusText?: string;

  success: boolean;
  error?: string;

  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;

  triggeredByInteractionId?: string;
}

export interface AggregatedNetworkGroup {
  pattern: string;
  count: number;
  avgDuration: number;
  statuses: Record<number, number>;
}

// ============================================
// CONSOLE LOGS
// ============================================

export interface ConsoleLogEntry {
  id: string;
  timestamp: number;

  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  stack?: string;

  relatedInteractionId?: string;
}

// ============================================
// ERRORS
// ============================================

export interface ErrorEntry {
  id: string;
  timestamp: number;

  message: string;
  stack?: string;
  source?: string;

  relatedNetworkRequestId?: string;
  relatedInteractionId?: string;
}

// ============================================
// VISIBILITY
// ============================================

export interface VisibilityEvent {
  id: string;
  timestamp: number;
  state: 'visible' | 'hidden';
}

// ============================================
// DOM SNAPSHOTS
// ============================================

export interface DOMSnapshot {
  id: string;
  timestamp: number;

  url: string;
  importantElements: {
    selector: string;
    text?: string;
    role?: string;
  }[];

  fullHtmlCompressed?: string;
}

// ============================================
// METRICS
// ============================================

export interface SessionMetrics {
  totalInteractions: number;
  totalNetworkRequests: number;
  failedNetworkRequests: number;
  totalConsoleLogs: number;
  consoleErrorCount: number;
  totalErrors: number;
  totalNavigations: number;
  totalVisibilityChanges: number;
  totalSnapshots: number;
  wasBackgroundRestarted: boolean;
}

// ============================================
// DERIVED INSIGHTS (placeholder)
// ============================================

export interface DerivedInsights {
  detectedFailures?: {
    type: 'network' | 'runtime' | 'navigation';
    summary: string;
    relatedIds: string[];
  }[];

  suspectedUserIntent?: string;
  likelyTestCaseSteps?: string[];
  anomalyFlags?: string[];
}
