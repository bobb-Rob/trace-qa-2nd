/**
 * Content script telemetry types.
 * Strongly typed internal representations; mapped to wire format (TelemetryEvent) on flush.
 */

import type { EventBuffer } from './batching/eventBuffer';

// ============================================
// EVENT TYPES
// ============================================

export type TelemetryEventType =
  | 'click' | 'input' | 'scroll' | 'navigation' | 'error'
  | 'network' | 'console' | 'domSnapshot' | 'visibility';

// ============================================
// EVENT PAYLOADS
// ============================================

export interface ClickPayload {
  id: string;
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  selector: string;
  tagName: string;
  textContent: string;
  ariaLabel?: string;
  role?: string;
  pageUrl: string;
  button: number;
  isDoubleClick: boolean;
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export interface InputPayload {
  id: string;
  selector: string;
  tagName: string;
  inputType: string;
  name: string;
  value: string;
  previousValue: string;
  ariaLabel?: string;
  role?: string;
  pageUrl: string;
  isFocused: boolean;
  isBlur: boolean;
}

export interface ScrollPayload {
  id: string;
  scrollX: number;
  scrollY: number;
  maxScrollX: number;
  maxScrollY: number;
  direction: 'up' | 'down' | 'left' | 'right';
  pageUrl: string;
  selector?: string;
}

export interface NavigationPayload {
  id: string;
  from: string;
  to: string;
  navigationType: 'pushState' | 'replaceState' | 'hashchange' | 'reload';
}

export interface ErrorPayload {
  id: string;
  message: string;
  name: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  errorType: 'uncaught' | 'unhandledrejection';
}

export interface NetworkPayload {
  id: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBodySize: number;
  responseBodySize: number;
  contentType: string;
  initiatorType: string;
  timing: {
    startTime: number;
    duration: number;
    dnsLookup: number;
    tcpConnect: number;
    tlsHandshake: number;
    ttfb: number;
    contentDownload: number;
    blocked: number;
  };
  error?: string;
  isFromCache: boolean;
  hasAuth: boolean;
  success: boolean;
}

export interface ConsolePayload {
  id: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  stack?: string;
}

export interface DomSnapshotPayload {
  id: string;
  url: string;
  importantElements: {
    selector: string;
    text?: string;
    role?: string;
  }[];
}

export interface VisibilityPayload {
  id: string;
  state: 'visible' | 'hidden';
}

// ============================================
// INTERNAL EVENT STRUCTURE
// ============================================

export type TelemetryPayload =
  | ClickPayload
  | InputPayload
  | ScrollPayload
  | NavigationPayload
  | ErrorPayload
  | NetworkPayload
  | ConsolePayload
  | DomSnapshotPayload
  | VisibilityPayload;

export interface CapturedEvent {
  type: TelemetryEventType;
  timestamp: number;
  relativeTime: number;
  payload: TelemetryPayload;
}

// ============================================
// CAPTURE MODULE CONFIG
// ============================================

export interface CaptureConfig {
  sessionId: string;
  sessionStartTime: number;
  buffer: EventBuffer;
}
