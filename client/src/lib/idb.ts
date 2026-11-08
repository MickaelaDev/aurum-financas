const DB_NAME = 'aurum-vaults';
const VAULTS = 'vaults';
const ACCOUNTS = 'accounts';
const VERSION = 2;

let connection: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;

  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VAULTS)) {
        db.createObjectStore(VAULTS);
      }
      if (!db.objectStoreNames.contains(ACCOUNTS)) {
        db.createObjectStore(ACCOUNTS, { keyPath: 'id' });
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
    const tx = db.transaction(VAULTS, 'readonly');
    const request = tx.objectStore(VAULTS).get(userId);
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
    const tx = db.transaction(VAULTS, 'readwrite');
    tx.objectStore(VAULTS).put(bytes, userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao salvar o cofre local.'));
  });
}

export async function removeVault(userId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULTS, 'readwrite');
    tx.objectStore(VAULTS).delete(userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao remover o cofre local.'));
  });
}

/* ------------------------------------------------------------------ */
/* Contas locais                                                       */
/* ------------------------------------------------------------------ */

export type StoredAccount = {
  id: string;
  username: string;
  usernameNorm: string;
  salt: string;
  verifier: string;
  createdAt: number;
};

export async function readAccounts(): Promise<StoredAccount[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACCOUNTS, 'readonly');
    const request = tx.objectStore(ACCOUNTS).getAll();
    request.onsuccess = () => resolve((request.result as StoredAccount[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error('Falha ao ler as contas locais.'));
  });
}

export async function writeAccount(account: StoredAccount): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACCOUNTS, 'readwrite');
    tx.objectStore(ACCOUNTS).put(account);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao salvar a conta local.'));
  });
}

export async function removeAccount(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACCOUNTS, 'readwrite');
    tx.objectStore(ACCOUNTS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao remover a conta local.'));
  });
}
