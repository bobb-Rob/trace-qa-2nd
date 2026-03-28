/**
 * Main World Interceptors
 *
 * This script runs in the PAGE'S main world (not the isolated content script world)
 * at document_start — BEFORE any page JavaScript loads.
 *
 * It patches:
 * - history.pushState / history.replaceState (SPA navigation)
 * - window.fetch (network requests)
 * - XMLHttpRequest.prototype.open/send/setRequestHeader (network requests)
 *
 * Communication:
 * - Receives: __TRACEQA_CTRL__ messages from content script to activate/deactivate
 * - Sends:    __TRACEQA_NAV__ messages for navigation events
 * - Sends:    __TRACEQA_NET__ messages for network events
 *
 * The patches are installed immediately (before page JS) but data is only
 * sent via postMessage when `active === true`. This ensures:
 * 1. Frameworks can't cache the original references before we patch
 * 2. No overhead when not recording (postMessage is skipped)
 * 3. CSP-safe (Chrome injects this, not inline <script>)
 *
 * IMPORTANT: This file is compiled as a separate webpack entry point and
 * declared in manifest.json with "world": "MAIN", "run_at": "document_start".
 * It must be fully self-contained — no imports from other modules.
 */

(function () {
  // Guard against double-injection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.__traceqa_mw__) return;
  w.__traceqa_mw__ = true;

  // ─── Constants ───

  const CTRL_MSG = '__TRACEQA_CTRL__';
  const NET_MSG = '__TRACEQA_NET__';
  const NAV_MSG = '__TRACEQA_NAV__';

  // Headers to strip (sensitive) and keep (allowlist)
  const SENSITIVE = new Set([
    'authorization', 'cookie', 'set-cookie', 'proxy-authorization',
    'x-api-key', 'x-auth-token',
  ]);
  const ALLOWLIST = new Set([
    'content-type', 'accept', 'x-requested-with', 'origin',
    'referer', 'cache-control', 'content-length', 'x-request-id',
  ]);

  // ─── State ───

  let active = false;
  let idCounter = 0;

  // ─── Utilities ───

  function genId(): string {
    return 'mw_' + Date.now().toString(36) + '_' + (idCounter++).toString(36);
  }

  function post(type: string, data: unknown): void {
    if (!active) return;
    try {
      window.postMessage({ type, payload: data }, '*');
    } catch {
      // Swallow serialization errors
    }
  }

  function filterHeaders(
    headers: Headers | Record<string, string> | null
  ): { filtered: Record<string, string>; hasAuth: boolean } {
    const filtered: Record<string, string> = {};
    let hasAuth = false;

    if (!headers) return { filtered, hasAuth };

    const entries: [string, string][] =
      typeof (headers as Headers).entries === 'function'
        ? Array.from((headers as Headers).entries())
        : Object.entries(headers as Record<string, string>);

    for (const [key, value] of entries) {
      const lower = key.toLowerCase();
      if (SENSITIVE.has(lower)) {
        hasAuth = true;
        continue;
      }
      if (ALLOWLIST.has(lower)) {
        filtered[key] = value;
      }
    }
    return { filtered, hasAuth };
  }

  // ─── Activation listener ───

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    if (event.data?.type === CTRL_MSG) {
      active = !!event.data.payload?.active;
    }
  });

  // ═══════════════════════════════════════════
  // NAVIGATION INTERCEPTION
  // ═══════════════════════════════════════════

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (
    ...args: Parameters<typeof history.pushState>
  ): void {
    const from = location.href;
    originalPushState(...args);
    const to = location.href;
    if (from !== to) {
      post(NAV_MSG, { from, to, navigationType: 'pushState' });
    }
  };

  history.replaceState = function (
    ...args: Parameters<typeof history.replaceState>
  ): void {
    const from = location.href;
    originalReplaceState(...args);
    const to = location.href;
    if (from !== to) {
      post(NAV_MSG, { from, to, navigationType: 'replaceState' });
    }
  };

  // ═══════════════════════════════════════════
  // FETCH INTERCEPTION
  // ═══════════════════════════════════════════

  const originalFetch = window.fetch;

  window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // If not active, pass through immediately (zero overhead)
    if (!active) {
      return originalFetch.call(window, input, init);
    }

    let req: Request;
    try {
      req = new Request(input, init);
    } catch {
      return originalFetch.call(window, input, init);
    }

    const url = req.url;
    const method = (req.method || 'GET').toUpperCase();
    const startTime = Date.now();
    const id = genId();
    const reqH = filterHeaders(req.headers);

    let requestBodySize = 0;
    if (init?.body) {
      if (typeof init.body === 'string') requestBodySize = init.body.length;
      else if ((init.body as ArrayBuffer)?.byteLength !== undefined)
        requestBodySize = (init.body as ArrayBuffer).byteLength;
    }

    return originalFetch.call(window, input, init).then(
      (response: Response) => {
        const respH = filterHeaders(response.headers);
        const cl = response.headers.get('content-length');
        post(NET_MSG, {
          id,
          url,
          method,
          startTime,
          endTime: Date.now(),
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type') || '',
          requestHeaders: reqH.filtered,
          responseHeaders: respH.filtered,
          requestBodySize,
          responseBodySize: cl ? parseInt(cl, 10) : 0,
          hasAuth: reqH.hasAuth || respH.hasAuth,
          initiatorType: 'fetch',
        });
        return response;
      },
      (err: Error) => {
        post(NET_MSG, {
          id,
          url,
          method,
          startTime,
          endTime: Date.now(),
          status: 0,
          statusText: '',
          contentType: '',
          requestHeaders: reqH.filtered,
          responseHeaders: {},
          requestBodySize,
          responseBodySize: 0,
          hasAuth: reqH.hasAuth,
          error: err?.message || String(err) || 'Network error',
          initiatorType: 'fetch',
        });
        throw err;
      }
    );
  };

  // ═══════════════════════════════════════════
  // XHR INTERCEPTION
  // ═══════════════════════════════════════════

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  interface XHRMeta {
    method: string;
    url: string;
    id: string;
    reqHeaders: Record<string, string>;
    hasAuth: boolean;
  }

  const xhrStore = new WeakMap<XMLHttpRequest, XHRMeta>();

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ): void {
    xhrStore.set(this, {
      method: (method || 'GET').toUpperCase(),
      url: String(url),
      id: genId(),
      reqHeaders: {},
      hasAuth: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalOpen as any).apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (
    name: string,
    value: string
  ): void {
    const meta = xhrStore.get(this);
    if (meta) {
      const lower = name.toLowerCase();
      if (SENSITIVE.has(lower)) {
        meta.hasAuth = true;
      } else if (ALLOWLIST.has(lower)) {
        meta.reqHeaders[name] = value;
      }
    }
    return originalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null
  ): void {
    const meta = xhrStore.get(this);
    if (meta && active) {
      const startTime = Date.now();
      let requestBodySize = 0;
      if (typeof body === 'string') requestBodySize = body.length;
      else if (body && (body as ArrayBuffer).byteLength !== undefined)
        requestBodySize = (body as ArrayBuffer).byteLength;

      const xhr = this;
      xhr.addEventListener('loadend', () => {
        const rawH = xhr.getAllResponseHeaders() || '';
        const respHeaders: Record<string, string> = {};
        let respHasAuth = false;
        for (const line of rawH.split('\r\n')) {
          const idx = line.indexOf(':');
          if (idx === -1) continue;
          const k = line.substring(0, idx).trim().toLowerCase();
          const v = line.substring(idx + 1).trim();
          if (SENSITIVE.has(k)) {
            respHasAuth = true;
            continue;
          }
          if (ALLOWLIST.has(k)) {
            respHeaders[k] = v;
          }
        }
        const cl = xhr.getResponseHeader('content-length');
        post(NET_MSG, {
          id: meta.id,
          url: meta.url,
          method: meta.method,
          startTime,
          endTime: Date.now(),
          status: xhr.status,
          statusText: xhr.statusText || '',
          contentType: xhr.getResponseHeader('content-type') || '',
          requestHeaders: meta.reqHeaders,
          responseHeaders: respHeaders,
          requestBodySize,
          responseBodySize: cl ? parseInt(cl, 10) : 0,
          hasAuth: meta.hasAuth || respHasAuth,
          error: xhr.status === 0 ? 'net::ERR_FAILED' : undefined,
          initiatorType: 'xmlhttprequest',
        });
      });
    }
    return originalSend.call(this, body);
  };
})();
