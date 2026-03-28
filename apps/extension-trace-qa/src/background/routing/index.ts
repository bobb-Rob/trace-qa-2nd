/**
 * Routing Module
 *
 * Exports for the background service worker message routing system.
 *
 * @module background/routing
 */

export {
  type MessageHandler,
  registerHandler,
  unregisterHandler,
  routeMessage,
  initializeRouter,
  getHandlerCount,
  clearAllHandlers,
} from './messageRouter';
