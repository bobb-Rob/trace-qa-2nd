/**
 * FloatingPane - Draggable recording control pane
 *
 * Shows during video recording with:
 * - Timer display (HH:MM:SS)
 * - Pause/Resume button (gated by canPause for v1)
 * - Microphone mute toggle
 * - Stop button
 *
 * Uses Shadow DOM for style isolation from host page.
 *
 * IMPORTANT: This component is UI-only and must remain logic-free.
 * It does NOT import or reference FSM, MediaRecorder, or storage.
 * All behavior is expressed via intent callbacks (onAction).
 */

import type {
  ShowFloatingPanePayload,
  UpdateFloatingPanePayload,
  AudioUnavailableReason,
} from './shared/types';

interface FloatingPaneOptions {
  onAction: (action: 'pause' | 'resume' | 'stop' | 'toggleMute') => void;
  onPositionChange: (position: { x: number; y: number }) => void;
}

export class FloatingPane {
  private hostElement: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private options: FloatingPaneOptions;
  private isVisible = false;
  private isPaused = false;
  private isMuted = false;
  private duration = 0;
  private warning: string | null = null;
  private audioUnavailable = false;
  private audioUnavailableReason: AudioUnavailableReason | undefined = undefined;
  private canPause = false; // v1: stop-only, pause gated

  // Dragging state
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  // Use null as sentinel for uninitialized position (not { x: 0, y: 0 })
  private position: { x: number; y: number } | null = null;

  // DOM references
  private timerElement: HTMLSpanElement | null = null;
  private pauseButton: HTMLButtonElement | null = null;
  private muteButton: HTMLButtonElement | null = null;
  private warningElement: HTMLDivElement | null = null;
  private audioTooltipElement: HTMLDivElement | null = null;

  // Bound handlers (stored once to enable proper removeEventListener)
  private boundHandleDragMove: (e: MouseEvent) => void;
  private boundHandleDragEnd: () => void;
  private boundHandleDocumentClick: (e: MouseEvent) => void;

  constructor(options: FloatingPaneOptions) {
    this.options = options;

    // Bind handlers once and store references for proper cleanup
    this.boundHandleDragMove = this.handleDragMove.bind(this);
    this.boundHandleDragEnd = this.handleDragEnd.bind(this);
    this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);

    this.loadSavedPosition();
  }

  /**
   * Show the floating pane with initial state
   */
  public show(payload: ShowFloatingPanePayload): void {
    if (this.isVisible) return;

    this.isPaused = payload.isPaused;
    this.isMuted = payload.isMuted;
    this.duration = payload.duration;
    this.canPause = payload.canPause;
    this.audioUnavailable = payload.audioUnavailable ?? false;
    this.audioUnavailableReason = payload.audioUnavailableReason;

    this.createPane();
    this.isVisible = true;
    this.updateDisplay();
  }

  /**
   * Hide and remove the floating pane
   */
  public hide(): void {
    if (!this.isVisible) return;

    this.removePane();
    this.isVisible = false;
  }

  /**
   * Update the floating pane state
   */
  public update(payload: UpdateFloatingPanePayload): void {
    if (!this.isVisible) return;

    if (payload.isPaused !== undefined) {
      this.isPaused = payload.isPaused;
    }
    if (payload.isMuted !== undefined) {
      this.isMuted = payload.isMuted;
    }
    if (payload.duration !== undefined) {
      this.duration = payload.duration;
    }
    if (payload.warning !== undefined) {
      this.warning = payload.warning;
    }
    if (payload.audioUnavailable !== undefined) {
      this.audioUnavailable = payload.audioUnavailable;
    }
    if (payload.audioUnavailableReason !== undefined) {
      this.audioUnavailableReason = payload.audioUnavailableReason;
    }

    this.updateDisplay();
  }

  /**
   * Check if pane is visible
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.hide();
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Load saved position from storage
   * Position remains null if no saved position exists (triggers default on first show)
   */
  private async loadSavedPosition(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('floatingPanePosition');
      if (result.floatingPanePosition) {
        this.position = result.floatingPanePosition;
      }
      // If no saved position, this.position stays null (sentinel for uninitialized)
    } catch {
      // Use default position (null triggers default on setPosition)
    }
  }

  /**
   * Create the Shadow DOM pane
   */
  private createPane(): void {
    // Create host element
    this.hostElement = document.createElement('div');
    this.hostElement.id = 'traceqa-floating-pane';

    // Attach Shadow DOM
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'closed' });

    // Create styles
    const styles = document.createElement('style');
    styles.textContent = this.generateStyles();

    // Create pane content
    const pane = document.createElement('div');
    pane.className = 'floating-pane';
    pane.innerHTML = this.generateHTML();

    // Assemble Shadow DOM
    this.shadowRoot.appendChild(styles);
    this.shadowRoot.appendChild(pane);

    // Get DOM references
    this.timerElement = this.shadowRoot.querySelector('.timer');
    this.pauseButton = this.shadowRoot.querySelector('.pause-btn');
    this.muteButton = this.shadowRoot.querySelector('.mute-btn');
    this.warningElement = this.shadowRoot.querySelector('.warning');
    this.audioTooltipElement = this.shadowRoot.querySelector('.audio-tooltip');

    // Set up event listeners
    this.setupEventListeners(pane);

    // Set initial position
    this.setPosition();

    // Append to document
    document.body.appendChild(this.hostElement);
  }

  /**
   * Generate CSS styles
   */
  private generateStyles(): string {
    return `
      :host {
        all: initial;
        position: fixed !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .floating-pane {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(30, 30, 30, 0.95);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        cursor: move;
        user-select: none;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .floating-pane:hover {
        background: rgba(40, 40, 40, 0.98);
      }

      .recording-dot {
        width: 10px;
        height: 10px;
        background: #ef4444;
        border-radius: 50%;
        animation: pulse 1.5s ease-in-out infinite;
      }

      .recording-dot.paused {
        background: #f59e0b;
        animation: none;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(0.9); }
      }

      .timer {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
        font-variant-numeric: tabular-nums;
        min-width: 60px;
        text-align: center;
      }

      .divider {
        width: 1px;
        height: 20px;
        background: rgba(255, 255, 255, 0.2);
      }

      button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 16px;
      }

      button:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      button:active {
        transform: scale(0.95);
      }

      .pause-btn {
        background: rgba(59, 130, 246, 0.8);
      }

      .pause-btn:hover:not(:disabled) {
        background: rgba(59, 130, 246, 1);
      }

      .pause-btn.paused {
        background: rgba(34, 197, 94, 0.8);
      }

      .pause-btn.paused:hover:not(:disabled) {
        background: rgba(34, 197, 94, 1);
      }

      .pause-btn.disabled,
      .pause-btn:disabled {
        background: rgba(107, 114, 128, 0.4);
        color: rgba(255, 255, 255, 0.4);
        cursor: not-allowed;
      }

      .pause-btn:disabled:hover {
        background: rgba(107, 114, 128, 0.4);
      }

      .mute-btn.muted {
        background: rgba(239, 68, 68, 0.6);
      }

      .mute-btn.audio-unavailable {
        background: rgba(107, 114, 128, 0.6);
        cursor: help;
        position: relative;
      }

      .mute-btn.audio-unavailable::after {
        content: "!";
        position: absolute;
        top: -4px;
        right: -4px;
        width: 14px;
        height: 14px;
        background: #f59e0b;
        color: #000;
        font-size: 10px;
        font-weight: bold;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .audio-tooltip {
        display: none;
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 12px;
        background: rgba(30, 30, 30, 0.98);
        color: #fff;
        font-size: 12px;
        border-radius: 6px;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 10;
        max-width: 280px;
        white-space: normal;
        text-align: center;
      }

      .audio-tooltip.visible {
        display: block;
        animation: fadeIn 0.2s ease;
      }

      .audio-tooltip a {
        color: #60a5fa;
        text-decoration: underline;
        cursor: pointer;
      }

      .stop-btn {
        background: rgba(239, 68, 68, 0.8);
      }

      .stop-btn:hover {
        background: rgba(239, 68, 68, 1);
      }

      .warning {
        display: none;
        position: absolute;
        top: -36px;
        left: 50%;
        transform: translateX(-50%);
        padding: 6px 12px;
        background: rgba(245, 158, 11, 0.95);
        color: #000;
        font-size: 12px;
        font-weight: 500;
        border-radius: 4px;
        white-space: nowrap;
      }

      .warning.visible {
        display: block;
        animation: fadeIn 0.2s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(4px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      /* Icons using Unicode/text */
      .icon-pause::before { content: "⏸"; }
      .icon-play::before { content: "▶"; }
      .icon-mic::before { content: "🎤"; }
      .icon-mic-off::before { content: "🔇"; }
      .icon-stop::before { content: "⏹"; }
    `;
  }

  /**
   * Generate HTML content
   */
  private generateHTML(): string {
    return `
      <div class="warning"></div>
      <div class="audio-tooltip"></div>
      <div class="recording-dot"></div>
      <span class="timer">00:00</span>
      <div class="divider"></div>
      <button class="pause-btn" title="Pause/Resume">
        <span class="icon-pause"></span>
      </button>
      <button class="mute-btn" title="Toggle Microphone">
        <span class="icon-mic"></span>
      </button>
      <button class="stop-btn" title="Stop Recording">
        <span class="icon-stop"></span>
      </button>
    `;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(pane: HTMLDivElement): void {
    // Pause button - gated by canPause for v1 (stop-only)
    this.pauseButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      // Only emit pause/resume action if canPause is enabled
      if (this.canPause) {
        this.options.onAction(this.isPaused ? 'resume' : 'pause');
      }
    });

    // Mute button
    this.muteButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.audioUnavailable) {
        // Toggle tooltip visibility when audio is unavailable
        this.audioTooltipElement?.classList.toggle('visible');
      } else {
        this.options.onAction('toggleMute');
      }
    });

    // Stop button
    const stopBtn = this.shadowRoot?.querySelector('.stop-btn');
    stopBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.options.onAction('stop');
    });

    // Dragging - use stored bound handlers for proper cleanup
    pane.addEventListener('mousedown', this.handleDragStart.bind(this));
    document.addEventListener('mousemove', this.boundHandleDragMove);
    document.addEventListener('mouseup', this.boundHandleDragEnd);

    // Document-level click handler for closing tooltip when clicking outside
    document.addEventListener('click', this.boundHandleDocumentClick);
  }

  /**
   * Handle document-level clicks to close tooltip when clicking outside
   */
  private handleDocumentClick(e: MouseEvent): void {
    if (!this.audioTooltipElement?.classList.contains('visible')) return;

    // Check if click is inside the tooltip or mute button
    const target = e.target as Node;
    const isInsideTooltip = this.audioTooltipElement?.contains(target);
    const isInsideMuteButton = this.muteButton?.contains(target);

    // Close tooltip if clicking outside both tooltip and mute button
    if (!isInsideTooltip && !isInsideMuteButton) {
      this.audioTooltipElement?.classList.remove('visible');
    }
  }

  /**
   * Handle drag start
   */
  private handleDragStart(e: MouseEvent): void {
    // Don't start drag if clicking a button
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;

    this.isDragging = true;
    const rect = this.hostElement?.getBoundingClientRect();
    if (rect) {
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }

  /**
   * Handle drag move
   */
  private handleDragMove(e: MouseEvent): void {
    if (!this.isDragging || !this.hostElement) return;

    const x = e.clientX - this.dragOffset.x;
    const y = e.clientY - this.dragOffset.y;

    // Constrain to viewport
    const rect = this.hostElement.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    this.position = {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };

    this.applyPosition();
  }

  /**
   * Handle drag end
   */
  private handleDragEnd(): void {
    if (this.isDragging && this.position !== null) {
      this.isDragging = false;
      this.options.onPositionChange(this.position);
    }
  }

  /**
   * Set element position (initializes default if null, then applies)
   */
  private setPosition(): void {
    if (!this.hostElement) return;

    // Only apply default bottom-center positioning when position === null
    if (this.position === null) {
      const rect = this.hostElement.getBoundingClientRect();
      this.position = {
        x: (window.innerWidth - rect.width) / 2,
        y: window.innerHeight - rect.height - 10,
      };
    }

    this.applyPosition();
  }

  /**
   * Apply current position to DOM element
   */
  private applyPosition(): void {
    if (!this.hostElement || this.position === null) return;

    this.hostElement.style.left = `${this.position.x}px`;
    this.hostElement.style.top = `${this.position.y}px`;
  }

  /**
   * Update display based on current state
   */
  private updateDisplay(): void {
    if (!this.shadowRoot) return;

    // Update timer
    if (this.timerElement) {
      this.timerElement.textContent = this.formatDuration(this.duration);
    }

    // Update recording dot
    const dot = this.shadowRoot.querySelector('.recording-dot');
    if (dot) {
      dot.classList.toggle('paused', this.isPaused);
    }

    // Update pause button (gated by canPause for v1)
    if (this.pauseButton) {
      const icon = this.pauseButton.querySelector('span');
      if (icon) {
        icon.className = this.isPaused ? 'icon-play' : 'icon-pause';
      }
      this.pauseButton.classList.toggle('paused', this.isPaused);
      this.pauseButton.classList.toggle('disabled', !this.canPause);
      this.pauseButton.disabled = !this.canPause;

      if (!this.canPause) {
        this.pauseButton.title = 'Pause not available';
      } else {
        this.pauseButton.title = this.isPaused ? 'Resume' : 'Pause';
      }
    }

    // Update mute button
    if (this.muteButton) {
      const icon = this.muteButton.querySelector('span');
      if (icon) {
        icon.className = this.audioUnavailable ? 'icon-mic-off' : (this.isMuted ? 'icon-mic-off' : 'icon-mic');
      }
      this.muteButton.classList.toggle('muted', this.isMuted && !this.audioUnavailable);
      this.muteButton.classList.toggle('audio-unavailable', this.audioUnavailable);

      if (this.audioUnavailable) {
        this.muteButton.title = 'Microphone unavailable - click for help';
      } else {
        this.muteButton.title = this.isMuted ? 'Unmute Microphone' : 'Mute Microphone';
      }
    }

    // Update audio tooltip
    if (this.audioTooltipElement) {
      if (this.audioUnavailable) {
        const reasonText = this.getAudioUnavailableMessage();
        this.audioTooltipElement.innerHTML = reasonText;
      }
    }

    // Update warning
    if (this.warningElement) {
      this.warningElement.textContent = this.warning || '';
      this.warningElement.classList.toggle('visible', !!this.warning);
    }
  }

  /**
   * Get the appropriate message for why audio is unavailable
   */
  private getAudioUnavailableMessage(): string {
    switch (this.audioUnavailableReason) {
      case 'permission_denied':
        return `
          <strong>Microphone access denied</strong><br>
          To enable: Click the lock icon in your browser's address bar →
          Site settings → Allow Microphone
        `;
      case 'no_device':
        return `
          <strong>No microphone found</strong><br>
          Please connect a microphone and restart the recording.
        `;
      case 'device_in_use':
        return `
          <strong>Microphone in use</strong><br>
          Another application is using the microphone. Close it and restart.
        `;
      default:
        return `
          <strong>Microphone unavailable</strong><br>
          Recording continues without audio. Check browser settings to enable.
        `;
    }
  }

  /**
   * Format duration as HH:MM:SS or MM:SS
   */
  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number): string => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  /**
   * Remove pane from DOM and clean up all event listeners
   */
  private removePane(): void {
    // Remove document-level listeners using stored bound handlers
    document.removeEventListener('mousemove', this.boundHandleDragMove);
    document.removeEventListener('mouseup', this.boundHandleDragEnd);
    document.removeEventListener('click', this.boundHandleDocumentClick);

    if (this.hostElement?.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }

    this.hostElement = null;
    this.shadowRoot = null;
    this.timerElement = null;
    this.pauseButton = null;
    this.muteButton = null;
    this.warningElement = null;
    this.audioTooltipElement = null;
  }
}
