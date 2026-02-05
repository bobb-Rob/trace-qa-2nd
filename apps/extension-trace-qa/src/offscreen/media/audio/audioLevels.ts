/**
 * Audio Levels
 *
 * Measures audio activity for UI feedback.
 * Uses time-domain analysis for lightweight level detection.
 *
 * @module offscreen/media/audio/audioLevels
 */

let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let audioContext: AudioContext | null = null;

/**
 * Attach analyzer to audio source for level monitoring.
 * @param context - AudioContext instance
 * @param source - Audio source node to monitor
 */
export function attach(context: AudioContext, source: AudioNode): void {
  try {
    audioContext = context;
    analyser = context.createAnalyser();
    
    // Small FFT size for performance (time-domain only)
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    
    // Create Uint8Array with explicit ArrayBuffer
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(new ArrayBuffer(bufferLength));
    
    // Connect source to analyzer (analyzer doesn't affect audio output)
    source.connect(analyser);
    
    console.log('[AudioLevels] Attached:', {
      fftSize: analyser.fftSize,
      frequencyBinCount: analyser.frequencyBinCount,
    });
  } catch (error) {
    console.error('[AudioLevels] Failed to attach:', error);
    analyser = null;
    dataArray = null;
  }
}

/**
 * Get current audio level (0-1 normalized).
 * Returns 0 if analyzer not attached or no activity.
 * 
 * Uses time-domain data (waveform amplitude) for lightweight detection.
 */
export function getLevel(): number {
  if (!analyser || !dataArray) {
    return 0;
  }

  try {
    // Get time-domain data (audio waveform)
    // Type assertion needed for strict TypeScript typing compatibility
    analyser.getByteTimeDomainData(dataArray as any);
    
    // Calculate average absolute deviation from silence (128)
    let sum = 0;
    for (const value of dataArray) {
      const delta = value - 128;
      sum += Math.abs(delta);
    }
    
    // Normalize: typical speaking voice peaks around 20-40
    const average = sum / dataArray.length;
    const normalized = Math.min(average / 40, 1);
    
    return normalized;
  } catch (error) {
    console.warn('[AudioLevels] Error reading level:', error);
    return 0;
  }
}

/**
 * Get detailed level data (for debugging/diagnostics).
 */
export function getLevelDetail(): {
  level: number;
  raw: number;
  attached: boolean;
  contextState: string | null;
} {
  const level = getLevel();
  
  let raw = 0;
  if (analyser && dataArray) {
    // Type assertion needed for strict TypeScript typing compatibility
    analyser.getByteTimeDomainData(dataArray as any);
    let sum = 0;
    for (const value of dataArray) {
      sum += Math.abs(value - 128);
    }
    raw = sum / dataArray.length;
  }
  
  return {
    level,
    raw,
    attached: analyser !== null,
    contextState: audioContext?.state ?? null,
  };
}

/**
 * Detach analyzer and cleanup.
 * Idempotent - safe to call multiple times.
 */
export function detach(): void {
  if (analyser) {
    try {
      analyser.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    analyser = null;
  }
  
  dataArray = null;
  audioContext = null;
  
  console.log('[AudioLevels] Detached');
}

/**
 * Check if analyzer is attached and ready.
 */
export function isAttached(): boolean {
  return analyser !== null && dataArray !== null;
}
