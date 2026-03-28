/**
 * Message Router (Offscreen)
 *
 * Centralized message routing and handler registration for offscreen document.
 * Follows same pattern as background plane router.
 *
 * @module offscreen/routing/messageRouter
 */

type MessageHandler = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => boolean | void;

const handlers = new Map<string, MessageHandler>();

/**
 * Register a handler for a specific message type.
 * @param messageType - The message type to handle
 * @param handler - The handler function
 */
export function registerHandler(messageType: string, handler: MessageHandler): void {
  if (handlers.has(messageType)) {
    console.warn(`[OffscreenRouter] Overwriting existing handler for: ${messageType}`);
  }
  handlers.set(messageType, handler);
  console.log(`[OffscreenRouter] Handler registered: ${messageType}`);
}

/**
 * Route an incoming message to the appropriate handler.
 * Only handles messages intended for offscreen (OFFSCREEN_* prefix).
 * Silently ignores messages meant for other contexts.
 *
 * @param message - The message object
 * @param sender - Message sender info
 * @param sendResponse - Response callback
 * @returns true if handler will respond asynchronously, false to let other listeners handle
 */
export function routeMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  const messageType = message?.type;

  if (!messageType) {
    // No type - not a valid message, let other handlers deal with it
    return false;
  }

  // Only handle messages intended for offscreen (OFFSCREEN_* prefix)
  // Silently ignore messages meant for other contexts (e.g., GET_RECORDING_STATUS)
  if (!messageType.startsWith('OFFSCREEN_')) {
    // Not for offscreen - don't respond, let background handle it
    return false;
  }

  const handler = handlers.get(messageType);

  if (!handler) {
    console.warn(`[OffscreenRouter] No handler registered for: ${messageType}`);
    sendResponse({ success: false, error: `Unknown message type: ${messageType}` });
    return false;
  }

  // Invoke handler
  try {
    const result = handler(message, sender, sendResponse);
    return result === true; // true = async response
  } catch (error) {
    console.error(`[OffscreenRouter] Handler error for ${messageType}:`, error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Handler error',
    });
    return false;
  }
}

/**
 * Initialize the message router.
 * Sets up the chrome.runtime.onMessage listener.
 */
export function initializeRouter(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    return routeMessage(message, sender, sendResponse);
  });

  console.log('[OffscreenRouter] Message router initialized');
}

/**
 * Get all registered message types (for debugging).
 */
export function getRegisteredTypes(): string[] {
  return Array.from(handlers.keys());
}
