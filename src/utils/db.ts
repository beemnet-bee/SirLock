import { EncryptedDbEntry, AuditLogEntry } from '../types';

const DB_NAME = 'SirLockVault';
const DB_VERSION = 1;

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // 1. Files store
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }

      // 2. Config store (key-value pair storage)
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }

      // 3. Audit logs store
      if (!db.objectStoreNames.contains('logs')) {
        const logStore = db.createObjectStore('logs', { keyPath: 'id' });
        // index logs by timestamp for easy sorting
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Cleanly wipe the entire IndexedDB database (Self Destruct / Factory Reset)
 */
export function wipeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ==========================================
// CONFIG STORE API
// ==========================================

export async function getConfigValue<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('config', 'readonly');
    const store = transaction.objectStoreNames.contains('config') 
      ? transaction.objectStore('config')
      : null;

    if (!store) {
      resolve(null);
      return;
    }

    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result ? (request.result.value as T) : null);
    };
  });
}

export async function setConfigValue<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('config', 'readwrite');
    const store = transaction.objectStore('config');

    const request = store.put({ key, value });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ==========================================
// FILES STORE API
// ==========================================

export async function saveEncryptedFile(entry: EncryptedDbEntry): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');

    const request = store.put(entry);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllEncryptedFiles(): Promise<EncryptedDbEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readonly');
    const store = transaction.objectStore('files');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function deleteEncryptedFile(id: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');

    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ==========================================
// AUDIT LOGS STORE API
// ==========================================

export async function addAuditLog(
  action: AuditLogEntry['action'],
  details: string
): Promise<void> {
  const db = await openDb();
  const log: AuditLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    action,
    timestamp: Date.now(),
    details
  };

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('logs', 'readwrite');
    const store = transaction.objectStore('logs');

    const request = store.add(log);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('logs', 'readonly');
    const store = transaction.objectStore('logs');
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev'); // sort descending
    const logs: AuditLogEntry[] = [];

    request.onerror = () => reject(request.error);
    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        logs.push(cursor.value);
        cursor.continue();
      } else {
        resolve(logs);
      }
    };
  });
}

export async function clearAuditLogs(): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('logs', 'readwrite');
    const store = transaction.objectStore('logs');
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
