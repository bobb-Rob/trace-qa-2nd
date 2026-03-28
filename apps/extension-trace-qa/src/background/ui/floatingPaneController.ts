/**
 * FloatingPane Controller
 *
 * Manages the FloatingPane UI overlay in content scripts.
 * Handles injection confirmation, state updates, and lifecycle.
 * Supports single-tab (TAB mode), multi-tab (WINDOW mode), and all-tabs (DESKTOP mode).
 *
 * @module background/ui/floatingPaneController
 */

import type {
  ContentShowFloatingPanePayload,
  UpdateFloatingPanePayload,
  CaptureMode,
} from '../../shared/types';

// Timeout for waiting for CONTENT_SCRIPT_READY after injection
const INJECTION_READY_TIMEOUT_MS = 5000;

// Track tabs with confirmed content script presence (reset on extension reload)
const confirmedTabs = new Set<number>();

// Multi-tab FloatingPane state
const activePaneTabs = new Set<number>();
let currentCaptureMode: CaptureMode | null = null;
let currentWindowId: number | null = null;
let lastShowPayload: ContentShowFloatingPanePayload | null = null;

// Post-injection callback for telemetry activation
let postInjectionCallback: ((tabId: number) => void) | null = null;

/**
 * Set a callback to be invoked after a content script is injected into a tab.
 * Used by background/index.ts to send SESSION_STARTED after re-injection on navigation.
 */
export function setPostInjectionCallback(cb: ((tabId: number) => void) | null): void {
  postInjectionCallback = cb;
}

/**
 * Check if a tab URL is injectable (content scripts can only run on http/https/file).
 */
function isInjectableTab(tab: chrome.tabs.Tab): boolean {
  if (!tab.url) return false;
  return tab.url.startsWith('http://') || tab.url.startsWith('https://') || tab.url.startsWith('file://');
}

/**
 * Ensure content script is injected and ready in the target tab.
 * Uses a deterministic handshake:
 * 1. PING to check if already loaded (fast path)
 * 2. If not, inject via chrome.scripting.executeScript()
 * 3. Wait for CONTENT_SCRIPT_READY signal (no arbitrary delays)
 *
 * @returns true if content script is confirmed ready, false if injection failed
 */
export async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  // Fast path: already confirmed in this session
  if (confirmedTabs.has(tabId)) {
    return true;
  }

  // Try PING first (content script may already be loaded)
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (response?.type === 'PONG') {
      console.log('[FloatingPaneController] Content script already present in tab:', tabId);
      confirmedTabs.add(tabId);
      return true;
    }
  } catch {
    // PING failed - content script not loaded, proceed to injection
    console.log('[FloatingPaneController] PING failed, injecting content script into tab:', tabId);
  }

  // Inject content script and wait for READY signal
  return new Promise<boolean>((resolve) => {
    let resolved = false;

    // One-shot listener for CONTENT_SCRIPT_READY
    const readyListener = (
      message: { type: string },
      sender: chrome.runtime.MessageSender
    ) => {
      if (
        message.type === 'CONTENT_SCRIPT_READY' &&
        sender.tab?.id === tabId &&
        !resolved
      ) {
        resolved = true;
        chrome.runtime.onMessage.removeListener(readyListener);
        clearTimeout(timeoutId);
        console.log('[FloatingPaneController] Content script ready in tab:', tabId);
        confirmedTabs.add(tabId);
        resolve(true);
      }
    };

    // Timeout handler
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chrome.runtime.onMessage.removeListener(readyListener);
        console.warn('[FloatingPaneController] Timeout waiting for CONTENT_SCRIPT_READY in tab:', tabId);
        resolve(false);
      }
    }, INJECTION_READY_TIMEOUT_MS);

    // Register listener before injection
    chrome.runtime.onMessage.addListener(readyListener);

    // Inject the content script
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/index.js'],
    }).catch((error) => {
      if (!resolved) {
        resolved = true;
        chrome.runtime.onMessage.removeListener(readyListener);
        clearTimeout(timeoutId);
        console.error('[FloatingPaneController] Failed to inject content script:', error);
        resolve(false);
      }
    });
  });
}

/**
 * Show the FloatingPane in a single tab.
 * Ensures content script is injected before sending message.
 */
export async function showFloatingPane(tabId: number, payload: ContentShowFloatingPanePayload): Promise<void> {
  // Ensure content script is present
  const ready = await ensureContentScriptInjected(tabId);
  if (!ready) {
    console.warn('[FloatingPaneController] Cannot show FloatingPane - content script injection failed');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'CONTENT_SHOW_FLOATING_PANE',
      payload,
    });
    console.log('[FloatingPaneController] FloatingPane shown in tab:', tabId);
  } catch (error) {
    console.warn('[FloatingPaneController] Failed to show FloatingPane:', error);
  }
}

/**
 * Update the FloatingPane state in a single tab.
 */
export async function updateFloatingPane(tabId: number, payload: UpdateFloatingPanePayload): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'CONTENT_UPDATE_FLOATING_PANE',
      payload,
    });
  } catch {
    // Ignore errors - tab might be closed or content script not loaded
  }
}

/**
 * Hide the FloatingPane in a single tab.
 */
export async function hideFloatingPane(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'CONTENT_HIDE_FLOATING_PANE',
    });
    console.log('[FloatingPaneController] FloatingPane hidden in tab:', tabId);
  } catch {
    // Ignore errors - tab might be closed or content script not loaded
  }
}

/**
 * Clear confirmation tracking for a closed or navigated tab.
 */
export function clearTabConfirmation(tabId: number): void {
  confirmedTabs.delete(tabId);
}

// ─────────────────────────────────────────────────────────────
// Multi-Tab FloatingPane Management
// ─────────────────────────────────────────────────────────────

/**
 * Inject FloatingPane into a single tab and track it.
 */
async function injectIntoTab(tabId: number, payload: ContentShowFloatingPanePayload): Promise<void> {
  const ready = await ensureContentScriptInjected(tabId);
  if (ready) {
    await showFloatingPane(tabId, payload);
    activePaneTabs.add(tabId);
    postInjectionCallback?.(tabId);
  }
}

/**
 * Check if a tab is in scope for the current recording mode.
 */
function isTabInScope(tab: chrome.tabs.Tab): boolean {
  if (!currentCaptureMode) return false;
  if (!isInjectableTab(tab)) return false;

  if (currentCaptureMode === 'TAB') {
    // TAB mode: only the single recording tab (handled separately)
    return false;
  } else if (currentCaptureMode === 'WINDOW') {
    return tab.windowId === currentWindowId;
  } else {
    // DESKTOP: all tabs
    return true;
  }
}

/**
 * Show FloatingPane for the given capture mode.
 * - TAB: single tab
 * - WINDOW: all tabs in the specified window
 * - DESKTOP: all tabs across all windows
 */
export async function showFloatingPaneForMode(
  mode: CaptureMode | null,
  payload: ContentShowFloatingPanePayload,
  tabId?: number | null,
  windowId?: number | null
): Promise<void> {
  currentCaptureMode = mode;
  currentWindowId = windowId ?? null;
  lastShowPayload = payload;
  activePaneTabs.clear();

  if (!mode) return;

  if (mode === 'TAB' && tabId) {
    await injectIntoTab(tabId, payload);
  } else if (mode === 'WINDOW' && windowId) {
    const tabs = await chrome.tabs.query({ windowId });
    const injectPromises = tabs
      .filter((tab) => tab.id && isInjectableTab(tab))
      .map((tab) => injectIntoTab(tab.id!, payload));
    await Promise.allSettled(injectPromises);
    console.log('[FloatingPaneController] FloatingPane shown in window:', windowId, 'tabs:', activePaneTabs.size);
  } else if (mode === 'DESKTOP') {
    const tabs = await chrome.tabs.query({});
    const injectPromises = tabs
      .filter((tab) => tab.id && isInjectableTab(tab))
      .map((tab) => injectIntoTab(tab.id!, payload));
    await Promise.allSettled(injectPromises);
    console.log('[FloatingPaneController] FloatingPane shown in all tabs:', activePaneTabs.size);
  }
}

/**
 * Update FloatingPane state in all active tabs.
 */
export async function updateAllFloatingPanes(payload: UpdateFloatingPanePayload): Promise<void> {
  const updatePromises = [...activePaneTabs].map(async (tabId) => {
    try {
      await updateFloatingPane(tabId, payload);
    } catch {
      // Tab may be gone — remove from tracking
      activePaneTabs.delete(tabId);
    }
  });
  await Promise.allSettled(updatePromises);
}

/**
 * Hide FloatingPane in all active tabs and reset state.
 */
export async function hideAllFloatingPanes(): Promise<void> {
  const hidePromises = [...activePaneTabs].map((tabId) =>
    hideFloatingPane(tabId).catch(() => {})
  );
  await Promise.allSettled(hidePromises);

  activePaneTabs.clear();
  currentCaptureMode = null;
  currentWindowId = null;
  lastShowPayload = null;
}

/**
 * Initialize tab tracking listeners.
 * Should be called once during background script initialization.
 */
export function initializeTabTracking(): void {
  // Remove tab from confirmed and active sets when closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    confirmedTabs.delete(tabId);
    activePaneTabs.delete(tabId);
  });

  // Handle tab navigation and completion
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
      // Content script is unloaded on navigation
      confirmedTabs.delete(tabId);
      activePaneTabs.delete(tabId);
    }

    // Re-inject FloatingPane when navigated tab finishes loading (if recording is active)
    if (changeInfo.status === 'complete' && currentCaptureMode && lastShowPayload) {
      if (isTabInScope(tab)) {
        injectIntoTab(tabId, lastShowPayload).catch((error) => {
          console.warn('[FloatingPaneController] Failed to re-inject after navigation:', error);
        });
      }
    }
  });

  // Inject FloatingPane into newly created tabs (if in scope)
  // Note: onCreated fires before the tab has a URL, so actual injection
  // happens in onUpdated when status='complete'
  chrome.tabs.onCreated.addListener((tab) => {
    if (!currentCaptureMode || !lastShowPayload || !tab.id) return;
    // The tab will be caught by onUpdated(status='complete') once it loads
  });

  console.log('[FloatingPaneController] Tab tracking initialized');
}
