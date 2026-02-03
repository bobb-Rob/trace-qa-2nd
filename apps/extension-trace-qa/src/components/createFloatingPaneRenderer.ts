/**
 * createFloatingPaneRenderer - Imperative mount/unmount helper for FloatingPaneView
 *
 * This module provides an imperative API to mount the React-based FloatingPaneView
 * into a Shadow DOM, preserving the original class-based interface semantics.
 *
 * Responsibilities:
 * - Create host element and Shadow DOM
 * - Mount/unmount React component
 * - Load/save position from chrome.storage
 * - Provide show/update/hide methods matching original API
 *
 * IMPORTANT: This module does NOT contain business logic.
 * It is a rendering adapter only.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { FloatingPaneView, FloatingPaneViewState } from './FloatingPaneView';
import type {
  ShowFloatingPanePayload,
  UpdateFloatingPanePayload,
} from '../shared/types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface FloatingPaneRendererOptions {
  onAction: (action: 'pause' | 'resume' | 'stop' | 'toggleMute') => void;
  onPositionChange: (position: { x: number; y: number }) => void;
}

export interface FloatingPaneRenderer {
  show: (payload: ShowFloatingPanePayload) => void;
  update: (payload: UpdateFloatingPanePayload) => void;
  hide: () => void;
  getIsVisible: () => boolean;
  destroy: () => void;
}

// ─────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────

export function createFloatingPaneRenderer(
  options: FloatingPaneRendererOptions
): FloatingPaneRenderer {
  // Internal state
  let hostElement: HTMLDivElement | null = null;
  let shadowRoot: ShadowRoot | null = null;
  let reactRoot: Root | null = null;
  let isVisible = false;

  // View state (mirrors ShowFloatingPanePayload & UpdateFloatingPanePayload)
  let viewState: FloatingPaneViewState = {
    isPaused: false,
    isMuted: false,
    duration: 0,
    canPause: false,
    warning: null,
    audioUnavailable: false,
    audioUnavailableReason: undefined,
  };

  // Position state (null = sentinel for uninitialized, triggers default positioning)
  let position: { x: number; y: number } | null = null;

  // ─────────────────────────────────────────────────────────────
  // Position Persistence
  // ─────────────────────────────────────────────────────────────

  /**
   * Load saved position from chrome.storage
   * Position remains null if no saved position exists
   */
  async function loadSavedPosition(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('floatingPanePosition');
      if (result.floatingPanePosition) {
        position = result.floatingPanePosition;
      }
      // If no saved position, position stays null (sentinel for uninitialized)
    } catch {
      // Use default position (null triggers default in component)
    }
  }

  /**
   * Save position to chrome.storage
   */
  async function savePosition(pos: { x: number; y: number }): Promise<void> {
    try {
      await chrome.storage.local.set({ floatingPanePosition: pos });
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Handle position change from component
   */
  function handlePositionChange(newPosition: { x: number; y: number }): void {
    position = newPosition;
    savePosition(newPosition);
    options.onPositionChange(newPosition);
  }

  // Load position on creation
  loadSavedPosition();

  // ─────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────

  /**
   * Render React component into Shadow DOM
   */
  function render(): void {
    if (!reactRoot || !hostElement) return;

    reactRoot.render(
      React.createElement(FloatingPaneView, {
        state: viewState,
        position,
        onAction: options.onAction,
        onPositionChange: handlePositionChange,
        hostElement,
      })
    );
  }

  /**
   * Create host element and Shadow DOM, mount React
   */
  function mount(): void {
    if (hostElement) return; // Already mounted

    // Create host element
    hostElement = document.createElement('div');
    hostElement.id = 'traceqa-floating-pane';

    // Attach Shadow DOM (closed for style isolation)
    shadowRoot = hostElement.attachShadow({ mode: 'closed' });

    // Create container for React inside Shadow DOM
    const container = document.createElement('div');
    shadowRoot.appendChild(container);

    // Create React root
    reactRoot = createRoot(container);

    // Append to document
    document.body.appendChild(hostElement);

    // Initial render
    render();
  }

  /**
   * Unmount React and remove host element
   */
  function unmount(): void {
    if (reactRoot) {
      reactRoot.unmount();
      reactRoot = null;
    }

    if (hostElement?.parentNode) {
      hostElement.parentNode.removeChild(hostElement);
    }

    hostElement = null;
    shadowRoot = null;
  }

  // ─────────────────────────────────────────────────────────────
  // Public API (mirrors original FloatingPane class)
  // ─────────────────────────────────────────────────────────────

  /**
   * Show the floating pane with initial state
   */
  function show(payload: ShowFloatingPanePayload): void {
    if (isVisible) return;

    // Update view state from payload
    viewState = {
      isPaused: payload.isPaused,
      isMuted: payload.isMuted,
      duration: payload.duration,
      canPause: payload.canPause,
      warning: null,
      audioUnavailable: payload.audioUnavailable ?? false,
      audioUnavailableReason: payload.audioUnavailableReason,
    };

    mount();
    isVisible = true;
  }

  /**
   * Update the floating pane state
   */
  function update(payload: UpdateFloatingPanePayload): void {
    if (!isVisible) return;

    // Merge updates into view state
    if (payload.isPaused !== undefined) {
      viewState = { ...viewState, isPaused: payload.isPaused };
    }
    if (payload.isMuted !== undefined) {
      viewState = { ...viewState, isMuted: payload.isMuted };
    }
    if (payload.duration !== undefined) {
      viewState = { ...viewState, duration: payload.duration };
    }
    if (payload.warning !== undefined) {
      viewState = { ...viewState, warning: payload.warning };
    }
    if (payload.audioUnavailable !== undefined) {
      viewState = { ...viewState, audioUnavailable: payload.audioUnavailable };
    }
    if (payload.audioUnavailableReason !== undefined) {
      viewState = { ...viewState, audioUnavailableReason: payload.audioUnavailableReason };
    }

    render();
  }

  /**
   * Hide and remove the floating pane
   */
  function hide(): void {
    if (!isVisible) return;

    unmount();
    isVisible = false;
  }

  /**
   * Check if pane is visible
   */
  function getIsVisible(): boolean {
    return isVisible;
  }

  /**
   * Clean up resources
   */
  function destroy(): void {
    hide();
  }

  // Return public API
  return {
    show,
    update,
    hide,
    getIsVisible,
    destroy,
  };
}

export default createFloatingPaneRenderer;
