/**
 * Audio Mixer
 *
 * Manages Web Audio API mixing pipeline with mute control.
 * Uses GainNode for deterministic mute/unmute without track disruption.
 *
 * @module offscreen/media/audio/audioMixer
 */

let audioContext: AudioContext | null = null;
let destination: MediaStreamAudioDestinationNode | null = null;
let gainNode: GainNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let isMuted = false;

/**
 * Initialize the audio mixing pipeline.
 * Creates AudioContext and routing nodes.
 */
export function initialize(): void {
  try {
    audioContext = new AudioContext({
      sampleRate: 48000, // Match video standard
      latencyHint: 'interactive',
    });

    // Create audio graph: source → gain → destination
    destination = audioContext.createMediaStreamDestination();
    gainNode = audioContext.createGain();
    // Start with 2.5x gain (≈8dB boost) for comfortable listening levels
    // AGC provides baseline boost, this ensures minimum audibility
    gainNode.gain.value = 2.5; // Start unmuted with amplification

    // Connect gain to destination
    gainNode.connect(destination);

    console.log('[AudioMixer] Initialized:', {
      sampleRate: audioContext.sampleRate,
      state: audioContext.state,
    });

    // Handle AudioContext suspension (browser policy)
    if (audioContext.state === 'suspended') {
      console.warn('[AudioMixer] AudioContext suspended, will resume on user gesture');
    }
  } catch (error) {
    console.error('[AudioMixer] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Connect microphone stream to the mixing pipeline.
 * @param stream - Microphone MediaStream
 */
export function connectMic(stream: MediaStream): void {
  if (!audioContext || !gainNode || !destination) {
    console.error('[AudioMixer] Cannot connect mic: mixer not initialized');
    return;
  }

  if (sourceNode) {
    console.warn('[AudioMixer] Mic already connected, disconnecting first');
    disconnectMic();
  }

  try {
    // Resume AudioContext if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('[AudioMixer] AudioContext resumed');
      });
    }

    sourceNode = audioContext.createMediaStreamSource(stream);
    sourceNode.connect(gainNode);

    console.log('[AudioMixer] Microphone connected:', {
      trackCount: stream.getAudioTracks().length,
      contextState: audioContext.state,
    });
  } catch (error) {
    console.error('[AudioMixer] Failed to connect microphone:', error);
    sourceNode = null;
  }
}

/**
 * Disconnect microphone from the mixing pipeline.
 */
export function disconnectMic(): void {
  if (sourceNode) {
    try {
      sourceNode.disconnect();
      sourceNode = null;
      console.log('[AudioMixer] Microphone disconnected');
    } catch (error) {
      console.warn('[AudioMixer] Error disconnecting mic:', error);
    }
  }
}

/**
 * Set mute state via GainNode.
 * This keeps the audio track alive and allows instant unmute.
 * 
 * @param muted - true to mute, false to unmute
 */
export function setMuted(muted: boolean): void {
  if (!gainNode) {
    console.warn('[AudioMixer] Cannot set mute: mixer not initialized');
    return;
  }

  // Use GainNode for deterministic mute (gain = 0)
  // This avoids MediaRecorder glitches and allows instant unmute
  // When unmuting, restore to 2.5x gain for comfortable volume
  gainNode.gain.value = muted ? 0 : 2.5;
  isMuted = muted;

  console.log('[AudioMixer] Mute state changed:', { muted });
}

/**
 * Get current mute state.
 */
export function getMuted(): boolean {
  return isMuted;
}

/**
 * Get the mixed audio track for MediaRecorder.
 * @returns Mixed audio track or null if not available
 */
export function getMixedTrack(): MediaStreamTrack | null {
  if (!destination || !destination.stream) {
    console.warn('[AudioMixer] No mixed track available');
    return null;
  }

  const tracks = destination.stream.getAudioTracks();
  if (tracks.length === 0) {
    console.warn('[AudioMixer] Destination has no audio tracks');
    return null;
  }

  return tracks[0];
}

/**
 * Get the full mixed MediaStream (for testing/diagnostics).
 */
export function getMixedStream(): MediaStream | null {
  return destination?.stream ?? null;
}

/**
 * Destroy the audio mixing pipeline.
 * Idempotent - safe to call multiple times.
 */
export function destroy(): void {
  console.log('[AudioMixer] Destroying mixer');

  // Disconnect and cleanup
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    sourceNode = null;
  }

  if (gainNode) {
    try {
      gainNode.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    gainNode = null;
  }

  destination = null;

  if (audioContext) {
    if (audioContext.state !== 'closed') {
      audioContext.close().catch((err) => {
        console.warn('[AudioMixer] Error closing AudioContext:', err);
      });
    }
    audioContext = null;
  }

  isMuted = false;
  console.log('[AudioMixer] Destroyed');
}

/**
 * Get current mixer state (for diagnostics).
 */
export function getState(): {
  initialized: boolean;
  connected: boolean;
  muted: boolean;
  contextState: string | null;
} {
  return {
    initialized: audioContext !== null,
    connected: sourceNode !== null,
    muted: isMuted,
    contextState: audioContext?.state ?? null,
  };
}
