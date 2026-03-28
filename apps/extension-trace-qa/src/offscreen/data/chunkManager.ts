/**
 * Chunk Manager
 *
 * Manages video chunk accumulation and aggregation.
 * Tracks chunk sizes and provides final blob assembly.
 *
 * @module offscreen/data/chunkManager
 */

let recordedChunks: Blob[] = [];
let totalChunkSize = 0;

/**
 * Add a new chunk to the accumulation buffer.
 * @param chunk - Blob chunk from MediaRecorder ondataavailable
 */
export function addChunk(chunk: Blob): void {
  if (chunk.size > 0) {
    recordedChunks.push(chunk);
    totalChunkSize += chunk.size;

    console.log('[ChunkManager] Chunk added:', {
      chunkSize: chunk.size,
      totalChunks: recordedChunks.length,
      totalSize: totalChunkSize,
    });
  }
}

/**
 * Get the total accumulated chunk size in bytes.
 */
export function getTotalSize(): number {
  return totalChunkSize;
}

/**
 * Get the number of accumulated chunks.
 */
export function getChunkCount(): number {
  return recordedChunks.length;
}

/**
 * Assemble all chunks into a single final Blob.
 * @param mimeType - MIME type for the final blob
 * @returns The assembled video blob
 */
export function assembleBlob(mimeType: string): Blob {
  const blob = new Blob(recordedChunks, { type: mimeType });
  console.log('[ChunkManager] Blob assembled:', {
    chunkCount: recordedChunks.length,
    finalSize: blob.size,
    mimeType: blob.type,
  });
  return blob;
}

/**
 * Clear all accumulated chunks.
 */
export function clearChunks(): void {
  console.log('[ChunkManager] Clearing chunks:', {
    previousCount: recordedChunks.length,
    previousSize: totalChunkSize,
  });

  recordedChunks = [];
  totalChunkSize = 0;
}

/**
 * Get current chunk buffer state (for debugging/diagnostics).
 */
export function getChunkState(): { count: number; size: number } {
  return {
    count: recordedChunks.length,
    size: totalChunkSize,
  };
}
