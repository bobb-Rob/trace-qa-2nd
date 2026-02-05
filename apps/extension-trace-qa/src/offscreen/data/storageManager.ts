/**
 * Storage Manager
 *
 * Manages IndexedDB operations for temporary blob storage.
 * Provides blob persistence before download/export.
 *
 * @module offscreen/data/storageManager
 */

const DB_NAME = 'TraceQAOffscreenDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database.
 * Creates the recordings object store if needed.
 */
export async function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[StorageManager] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('[StorageManager] Database opened successfully');
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
        console.log('[StorageManager] Object store created:', STORE_NAME);
      }
    };
  });
}

/**
 * Store a blob in IndexedDB with the given session ID.
 * @param sessionId - Unique session identifier
 * @param blob - Video blob to store
 */
export async function storeBlob(sessionId: string, blob: Blob): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, sessionId);

    request.onsuccess = () => {
      console.log('[StorageManager] Blob stored:', {
        sessionId,
        size: blob.size,
      });
      resolve();
    };

    request.onerror = () => {
      console.error('[StorageManager] Failed to store blob:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Retrieve a blob from IndexedDB by session ID.
 * @param sessionId - Session identifier
 * @returns The stored blob, or null if not found
 */
export async function retrieveBlob(sessionId: string): Promise<Blob | null> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(sessionId);

    request.onsuccess = () => {
      const blob = request.result as Blob | undefined;
      console.log('[StorageManager] Blob retrieved:', {
        sessionId,
        found: !!blob,
        size: blob?.size,
      });
      resolve(blob ?? null);
    };

    request.onerror = () => {
      console.error('[StorageManager] Failed to retrieve blob:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Delete a blob from IndexedDB by session ID.
 * @param sessionId - Session identifier
 */
export async function deleteBlob(sessionId: string): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(sessionId);

    request.onsuccess = () => {
      console.log('[StorageManager] Blob deleted:', sessionId);
      resolve();
    };

    request.onerror = () => {
      console.error('[StorageManager] Failed to delete blob:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[StorageManager] Database closed');
  }
}

/**
 * Check if database is initialized.
 */
export function isDatabaseReady(): boolean {
  return db !== null;
}
