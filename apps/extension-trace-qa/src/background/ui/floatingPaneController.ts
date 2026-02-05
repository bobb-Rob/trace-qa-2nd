/**
 * FloatingPane Controller
 *
 * Manages the FloatingPane UI overlay in content scripts.
 * Handles injection confirmation, state updates, and lifecycle.
 *
 * @module background/ui/floatingPaneController
 */

import type {
  ContentShowFloatingPanePayload,
  UpdateFloatingPanePayload,
} from '../../shared/types';

// Timeout for waiting for CONTENT_SCRIPT_READY after injection
const INJECTION_READY_TIMEOUT_MS = 5000;

// Track tabs with confirmed content script presence (reset on extension reload)
const confirmedTabs = new Set<number>();

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
 * Show the FloatingPane in the content script for TAB recording mode.
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
 * Update the FloatingPane state in the content script.
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
 * Hide the FloatingPane in the content script.
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

/**
 * Initialize tab tracking listeners.
 * Should be called once during background script initialization.
 */
export function initializeTabTracking(): void {
  // Remove tab from confirmed set when tab is closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    confirmedTabs.delete(tabId);
  });

  // Clear confirmation on navigation (content script may be unloaded)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      confirmedTabs.delete(tabId);
    }
  });

  console.log('[FloatingPaneController] Tab tracking initialized');
}
