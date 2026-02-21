/**
 * SPA navigation capture module.
 *
 * Captures navigation events from two sources:
 * 1. Main world script (main-world.ts) — intercepts history.pushState/replaceState
 *    at document_start before SPA frameworks can cache the original references.
 *    Sends events via window.postMessage(__TRACEQA_NAV__).
 * 2. DOM event listeners — popstate (back/forward) and hashchange events,
 *    which fire on the shared DOM and work from the content script.
 */

import type { CaptureConfig, NavigationPayload } from '../types';
import { sanitizeUrl } from '../utils/sanitization';
import { sessionRelativeTime, generateId } from '../utils/timing';

const NAV_MSG_TYPE = '__TRACEQA_NAV__';

export function startNavigationCapture(config: CaptureConfig): () => void {
  let currentUrl = location.href;

  function emitNavigation(
    navigationType: NavigationPayload['navigationType'],
    fromUrl?: string,
    toUrl?: string,
  ): void {
    const from = fromUrl ?? currentUrl;
    const to = toUrl ?? location.href;
    if (from === to) return;

    const now = Date.now();
    const payload: NavigationPayload = {
      id: generateId(),
      from: sanitizeUrl(from),
      to: sanitizeUrl(to),
      navigationType,
    };

    config.buffer.push({
      type: 'navigation',
      timestamp: now,
      relativeTime: sessionRelativeTime(config.sessionStartTime),
      payload,
    });

    currentUrl = to;
  }

  // ─── Source 1: Main world pushState/replaceState events ───

  function handleMainWorldNav(event: MessageEvent): void {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== NAV_MSG_TYPE) return;

    const data = event.data.payload;
    if (!data) return;

    emitNavigation(
      data.navigationType as NavigationPayload['navigationType'],
      data.from,
      data.to,
    );
  }

  window.addEventListener('message', handleMainWorldNav);

  // ─── Source 2: DOM events (popstate, hashchange) ───
  // These fire on the shared window object and work from the content script.

  function handlePopState(): void {
    emitNavigation('pushState'); // popstate fires on back/forward
  }

  function handleHashChange(): void {
    emitNavigation('hashchange');
  }

  window.addEventListener('popstate', handlePopState);
  window.addEventListener('hashchange', handleHashChange);

  return () => {
    window.removeEventListener('message', handleMainWorldNav);
    window.removeEventListener('popstate', handlePopState);
    window.removeEventListener('hashchange', handleHashChange);
  };
}
