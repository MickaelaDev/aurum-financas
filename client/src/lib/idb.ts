const DB_NAME = 'aurum-vaults';
const STORE = 'vaults';
const VERSION = 1;

let connection: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;

  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o armazenamento local.'));
  });

  return connection;
}

export async function readVault(userId: string): Promise<Uint8Array | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(userId);
    request.onsuccess = () => {
      const value = request.result;
      resolve(value instanceof Uint8Array ? value : null);
    };
    request.onerror = () => reject(request.error ?? new Error('Falha ao ler o cofre local.'));
  });
}

export async function writeVault(userId: string, bytes: Uint8Array): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(bytes, userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao salvar o cofre local.'));
  });
}

export async function removeVault(userId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao remover o cofre local.'));
  });
}
