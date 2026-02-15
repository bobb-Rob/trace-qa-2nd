/**
 * FloatingPaneView - React component for draggable recording control pane
 *
 * Shows during video recording with:
 * - Timer display (HH:MM:SS)
 * - Pause/Resume button (gated by canPause for v1)
 * - Microphone mute toggle
 * - Stop button
 *
 * IMPORTANT: This component is UI-only and must remain logic-free.
 * It does NOT import or reference FSM, MediaRecorder, or storage.
 * All behavior is expressed via intent callbacks (onAction).
 *
 * React is used ONLY as a rendering mechanism.
 * Business logic, lifecycle, and state ownership remain outside React.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { AudioUnavailableReason } from '../shared/types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface FloatingPaneViewState {
  isPaused: boolean;
  isMuted: boolean;
  duration: number;
  canPause: boolean;
  warning?: string | null;
  audioUnavailable?: boolean;
  audioUnavailableReason?: AudioUnavailableReason;
}

export interface FloatingPaneViewProps {
  state: FloatingPaneViewState;
  position: { x: number; y: number } | null;
  onAction: (action: 'pause' | 'resume' | 'stop' | 'toggleMute') => void;
  onPositionChange: (position: { x: number; y: number }) => void;
  hostElement: HTMLElement;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export const FloatingPaneView: React.FC<FloatingPaneViewProps> = ({
  state,
  position,
  onAction,
  onPositionChange,
  hostElement,
}) => {
  const {
    isPaused,
    isMuted,
    duration,
    canPause,
    warning,
    audioUnavailable = false,
    audioUnavailableReason,
  } = state;

  // Local UI state (dragging & tooltip only)
  const [isDragging, setIsDragging] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Refs for drag handling
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const currentPositionRef = useRef(position);
  const paneRef = useRef<HTMLDivElement>(null);
  const muteButtonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Keep position ref in sync with prop
  useEffect(() => {
    currentPositionRef.current = position;
  }, [position]);

  // ─────────────────────────────────────────────────────────────
  // Position Handling
  // ─────────────────────────────────────────────────────────────

  // Apply position to host element
  const applyPosition = useCallback((pos: { x: number; y: number } | null) => {
    if (!pos) return;
    hostElement.style.left = `${pos.x}px`;
    hostElement.style.top = `${pos.y}px`;
  }, [hostElement]);

  // Initialize default position when position is null (sentinel)
  useEffect(() => {
    if (position === null && paneRef.current) {
      const rect = hostElement.getBoundingClientRect();
      const defaultPos = {
        x: (window.innerWidth - rect.width) / 2,
        y: 10,
      };
      currentPositionRef.current = defaultPos;
      applyPosition(defaultPos);
      // Notify parent of default position
      onPositionChange(defaultPos);
    } else {
      applyPosition(position);
    }
  }, [position, applyPosition, hostElement, onPositionChange]);

  // ─────────────────────────────────────────────────────────────
  // Drag Handling (document-level listeners)
  // ─────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking a button
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;

    setIsDragging(true);
    const rect = hostElement.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, [hostElement]);

  // Document-level drag move handler
  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const x = e.clientX - dragOffsetRef.current.x;
      const y = e.clientY - dragOffsetRef.current.y;

      // Constrain to viewport
      const rect = hostElement.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      const newPosition = {
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY)),
      };

      currentPositionRef.current = newPosition;
      applyPosition(newPosition);
    };

    const handleDragEnd = () => {
      if (isDragging && currentPositionRef.current !== null) {
        setIsDragging(false);
        onPositionChange(currentPositionRef.current);
      }
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, hostElement, applyPosition, onPositionChange]);

  // ─────────────────────────────────────────────────────────────
  // Tooltip Click-Outside Handler
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (!tooltipVisible) return;

      const target = e.target as Node;
      const isInsideTooltip = tooltipRef.current?.contains(target);
      const isInsideMuteButton = muteButtonRef.current?.contains(target);

      if (!isInsideTooltip && !isInsideMuteButton) {
        setTooltipVisible(false);
      }
    };

    document.addEventListener('click', handleDocumentClick);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [tooltipVisible]);

  // ─────────────────────────────────────────────────────────────
  // Button Handlers
  // ─────────────────────────────────────────────────────────────

  const handlePauseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canPause) {
      onAction(isPaused ? 'resume' : 'pause');
    }
  }, [canPause, isPaused, onAction]);

  const handleMuteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioUnavailable) {
      setTooltipVisible((v) => !v);
    } else {
      onAction('toggleMute');
    }
  }, [audioUnavailable, onAction]);

  const handleStopClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAction('stop');
  }, [onAction]);

  // ─────────────────────────────────────────────────────────────
  // Formatting Helpers
  // ─────────────────────────────────────────────────────────────

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number): string => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const getAudioUnavailableMessage = (): string => {
    switch (audioUnavailableReason) {
      case 'permission_denied':
        return `<strong>Microphone access denied</strong><br>
          To enable: Click the lock icon in your browser's address bar →
          Site settings → Allow Microphone`;
      case 'no_device':
        return `<strong>No microphone found</strong><br>
          Please connect a microphone and restart the recording.`;
      case 'device_in_use':
        return `<strong>Microphone in use</strong><br>
          Another application is using the microphone. Close it and restart.`;
      default:
        return `<strong>Microphone unavailable</strong><br>
          Recording continues without audio. Check browser settings to enable.`;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Derived State
  // ─────────────────────────────────────────────────────────────

  const pauseButtonTitle = !canPause
    ? 'Pause not available'
    : isPaused
      ? 'Resume'
      : 'Pause';

  const muteButtonTitle = audioUnavailable
    ? 'Microphone unavailable - click for help'
    : isMuted
      ? 'Unmute Microphone'
      : 'Mute Microphone';

  const pauseIconClass = isPaused ? 'icon-play' : 'icon-pause';
  const muteIconClass = audioUnavailable ? 'icon-mic-off' : isMuted ? 'icon-mic-off' : 'icon-mic';

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{generateStyles()}</style>
      <div
        ref={paneRef}
        className="floating-pane"
        onMouseDown={handleDragStart}
      >
        {/* Warning banner */}
        <div className={`warning ${warning ? 'visible' : ''}`}>
          {warning || ''}
        </div>

        {/* Audio tooltip */}
        <div
          ref={tooltipRef}
          className={`audio-tooltip ${tooltipVisible ? 'visible' : ''}`}
          dangerouslySetInnerHTML={{ __html: audioUnavailable ? getAudioUnavailableMessage() : '' }}
        />

        {/* Recording indicator */}
        <div className={`recording-dot ${isPaused ? 'paused' : ''}`} />

        {/* Timer */}
        <span className="timer">{formatDuration(duration)}</span>

        <div className="divider" />

        {/* Pause button */}
        <button
          className={`pause-btn ${isPaused ? 'paused' : ''} ${!canPause ? 'disabled' : ''}`}
          onClick={handlePauseClick}
          disabled={!canPause}
          title={pauseButtonTitle}
        >
          <span className={pauseIconClass} />
        </button>

        {/* Mute button */}
        <button
          ref={muteButtonRef}
          className={`mute-btn ${isMuted && !audioUnavailable ? 'muted' : ''} ${audioUnavailable ? 'audio-unavailable' : ''}`}
          onClick={handleMuteClick}
          title={muteButtonTitle}
        >
          <span className={muteIconClass} />
        </button>

        {/* Stop button */}
        <button
          className="stop-btn"
          onClick={handleStopClick}
          title="Stop Recording"
        >
          <span className="icon-stop" />
        </button>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles (inline for Shadow DOM isolation)
// ─────────────────────────────────────────────────────────────

function generateStyles(): string {
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

export default FloatingPaneView;
