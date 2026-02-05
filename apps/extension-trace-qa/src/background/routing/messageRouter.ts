/**
 * Message Router
 *
 * Centralized message routing for the background service worker.
 * Handlers register themselves for specific message types using a clean registration pattern.
 *
 * This module decouples message dispatch logic from handler implementations.
 *
 * @module background/routing
 */

/**
 * Message handler function signature.
 * @param message - The incoming message
 * @param sender - The message sender
 * @param sendResponse - Callback to send a response (for async handlers, must return true)
 * @returns true if the response will be sent asynchronously, false otherwise
 */
export type MessageHandler = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => boolean | void;

/**
 * Registry of message handlers by message type.
 */
const handlers = new Map<string, MessageHandler>();

/**
 * Register a handler for a specific message type.
 * @param messageType - The message type to handle (e.g., 'START_RECORDING')
 * @param handler - The handler function
 */
export function registerHandler(messageType: string, handler: MessageHandler): void {
  if (handlers.has(messageType)) {
    console.warn(`[MessageRouter] Handler for '${messageType}' already registered. Overwriting.`);
  }
  handlers.set(messageType, handler);
  console.log(`[MessageRouter] Registered handler for '${messageType}'`);
}

/**
 * Unregister a handler for a specific message type.
 * @param messageType - The message type to unregister
 */
export function unregisterHandler(messageType: string): void {
  if (handlers.delete(messageType)) {
    console.log(`[MessageRouter] Unregistered handler for '${messageType}'`);
  } else {
    console.warn(`[MessageRouter] No handler registered for '${messageType}'`);
  }
}

/**
 * Route an incoming message to the appropriate handler.
 * @param message - The incoming message
 * @param sender - The message sender
 * @param sendResponse - Callback to send a response
 * @returns true if the response will be sent asynchronously, false otherwise
 */
export function routeMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (!message || typeof message.type !== 'string') {
    console.error('[MessageRouter] Invalid message format:', message);
    sendResponse({ success: false, error: 'Invalid message format' });
    return false;
  }

  const messageType = message.type;
  const handler = handlers.get(messageType);

  if (!handler) {
    console.warn(`[MessageRouter] No handler registered for message type: '${messageType}'`);
    sendResponse({ success: false, error: 'Unknown message type' });
    return false;
  }

  console.log(`[MessageRouter] Routing message of type '${messageType}'`);

  try {
    const result = handler(message, sender, sendResponse);
    // Return true if handler indicates async response, false otherwise
    return result === true;
  } catch (error) {
    console.error(`[MessageRouter] Error handling message type '${messageType}':`, error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Initialize the message router by setting up the chrome.runtime.onMessage listener.
 * This should be called once during service worker initialization.
 */
export function initializeRouter(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    return routeMessage(message, sender, sendResponse);
  });
  console.log('[MessageRouter] Initialized and listening for messages');
}

/**
 * Get the count of registered handlers (useful for testing/debugging).
 */
export function getHandlerCount(): number {
  return handlers.size;
}

/**
 * Clear all registered handlers (useful for testing).
 */
export function clearAllHandlers(): void {
  handlers.clear();
  console.log('[MessageRouter] Cleared all handlers');
}
