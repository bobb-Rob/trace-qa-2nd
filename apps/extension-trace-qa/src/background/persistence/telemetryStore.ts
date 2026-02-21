/**
 * Telemetry Store
 *
 * IndexedDB storage for telemetry event batches.
 * Separate database from the offscreen media database.
 *
 * @module background/persistence/telemetryStore
 */

import type { TelemetryEvent } from '../../shared/contracts/events';
import type { RecordedSession } from '../../shared/contracts/telemetryPayload';

// ============================================
// CONSTANTS
// ============================================

const DB_NAME = 'traceqa-telemetry';
const DB_VERSION = 2;
const STORE_NAME = 'batches';
const SESSIONS_STORE_NAME = 'sessions';

// ============================================
// TYPES
// ============================================

export interface StoredTelemetryBatch {
  key: string;
  sessionId: string;
  batchId: string;
  events: TelemetryEvent[];
  metadata: {
    capturedAt: number;
    eventCount: number;
    byteSize: number;
    url: string;
    isPartial: boolean;
  };
  storedAt: number;
}

// ============================================
// STATE
// ============================================

let db: IDBDatabase | null = null;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Open/create the telemetry IndexedDB database.
 * Idempotent - safe to call multiple times.
 */
export async function initTelemetryStore(): Promise<void> {
  if (db) return;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[TelemetryStore] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('[TelemetryStore] Database opened successfully');
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

      if (oldVersion < 1) {
        const store = database.createObjectStore(STORE_NAME);
        store.createIndex('sessionId', 'sessionId', { unique: false });
        console.log('[TelemetryStore] Object store created:', STORE_NAME);
      }
      if (oldVersion < 2) {
        database.createObjectStore(SESSIONS_STORE_NAME, { keyPath: 'sessionId' });
        console.log('[TelemetryStore] Object store created:', SESSIONS_STORE_NAME);
      }
    };
  });
}

// ============================================
// OPERATIONS
// ============================================

/**
 * Store a telemetry batch.
 */
export async function storeTelemetryBatch(batch: StoredTelemetryBatch): Promise<void> {
  if (!db) {
    await initTelemetryStore();
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(batch, batch.key);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('[TelemetryStore] Failed to store batch:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Retrieve all telemetry batches for a session.
 */
export async function getTelemetryBatches(sessionId: string): Promise<StoredTelemetryBatch[]> {
  if (!db) {
    await initTelemetryStore();
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);

    request.onsuccess = () => resolve(request.result as StoredTelemetryBatch[]);
    request.onerror = () => {
      console.error('[TelemetryStore] Failed to get batches:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Delete all telemetry batches for a session.
 */
export async function deleteTelemetryBatches(sessionId: string): Promise<void> {
  if (!db) {
    await initTelemetryStore();
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('sessionId');
    const request = index.getAllKeys(sessionId);

    request.onsuccess = () => {
      const keys = request.result;
      let remaining = keys.length;
      if (remaining === 0) {
        resolve();
        return;
      }
      for (const key of keys) {
        const deleteRequest = store.delete(key);
        deleteRequest.onsuccess = () => {
          remaining--;
          if (remaining === 0) resolve();
        };
        deleteRequest.onerror = () => reject(deleteRequest.error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store a consolidated session payload.
 */
export async function storeSessionPayload(payload: RecordedSession): Promise<void> {
  if (!db) {
    await initTelemetryStore();
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(SESSIONS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE_NAME);
    const request = store.put(payload);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('[TelemetryStore] Failed to store session payload:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Retrieve a consolidated session payload.
 */
export async function getSessionPayload(sessionId: string): Promise<RecordedSession | null> {
  if (!db) {
    await initTelemetryStore();
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(SESSIONS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE_NAME);
    const request = store.get(sessionId);

    request.onsuccess = () => resolve(request.result as RecordedSession | null);
    request.onerror = () => {
      console.error('[TelemetryStore] Failed to get session payload:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Close the database connection.
 */
export function closeTelemetryStore(): void {
  if (db) {
    db.close();
    db = null;
  }
}
