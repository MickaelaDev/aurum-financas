import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { Database } from 'sql.js';
import {
  createAccount,
  findAccount,
  verifyKey,
  type LocalAccount,
} from '../lib/accounts';
import { decryptVault, deriveVaultKey, encryptVault, randomBase64 } from '../lib/crypto';
import { createDatabase, exportData, importData } from '../lib/db';
import { readVault, writeVault } from '../lib/idb';
import { seedVault } from '../lib/seed';
import type { AppUser } from '../lib/types';
import { todayISO } from '../lib/date';

type Phase = 'locked' | 'loading' | 'ready';

type LastUser = {
  username: string;
  userId: string;
  salt: string;
};

type AppContextValue = {
  phase: Phase;
  user: AppUser | null;
  lastUsername: string;
  db: Database;
  version: number;
  savedAt: number | null;
  online: boolean;
  error: string | null;
  register: (username: string, pin: string) => Promise<void>;
  unlock: (username: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  bump: () => void;
  downloadBackup: () => void;
  importBackup: (file: File) => Promise<number>;
  clearError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const LAST_USER_KEY = 'aurum.last-user';

function readLastUser(): LastUser | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastUser>;
    if (!parsed.username || !parsed.userId || !parsed.salt) return null;
    return { username: parsed.username, userId: parsed.userId, salt: parsed.salt };
  } catch {
    return null;
  }
}

function writeLastUser(value: LastUser): void {
  try {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(value));
  } catch {
    // armazenamento indisponível — segue sem lembrar o nome
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const last = useMemo(() => readLastUser(), []);

  const [phase, setPhase] = useState<Phase>('locked');
  const [user, setUser] = useState<AppUser | null>(null);
  const [lastUsername, setLastUsername] = useState(last?.username ?? '');
  const [version, setVersion] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  const dbRef = useRef<Database | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const userRef = useRef<AppUser | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const enqueueSave = useCallback((): Promise<void> => {
    saveChainRef.current = saveChainRef.current
      .then(async () => {
        const db = dbRef.current;
        const key = keyRef.current;
        const currentUser = userRef.current;
        if (!db || !key || !currentUser) return;
        const bytes = db.export();
        const encrypted = await encryptVault(key, bytes);
        await writeVault(currentUser.id, encrypted);
        setSavedAt(Date.now());
      })
      .catch((saveError) => {
        console.error('Falha ao salvar o cofre local.', saveError);
      });
    return saveChainRef.current;
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void enqueueSave();
    }, 450);
  }, [enqueueSave]);

  const bump = useCallback(() => {
    setVersion((current) => current + 1);
    scheduleSave();
  }, [scheduleSave]);

  const finishUnlock = useCallback(
    (db: Database, key: CryptoKey, nextUser: AppUser, salt: string) => {
      dbRef.current = db;
      keyRef.current = key;
      userRef.current = nextUser;
      setUser(nextUser);
      setLastUsername(nextUser.username);
      writeLastUser({ username: nextUser.username, userId: nextUser.id, salt });
      setPhase('ready');
      setError(null);
      navigate('/', { replace: true });
    },
    [navigate],
  );

  const unlock = useCallback(
    async (username: string, pin: string) => {
      const normalized = username.trim();
      setPhase('loading');
      setError(null);

      let account: LocalAccount | null = null;
      try {
        account = await findAccount(normalized);
      } catch {
        setPhase('locked');
        setError('Não foi possível ler os dados deste navegador.');
        return;
      }

      if (!account) {
        setPhase('locked');
        setError(
          'Nenhum cofre com esse nome foi encontrado neste navegador. Confira o nome ou crie um novo cofre.',
        );
        return;
      }

      let key: CryptoKey;
      try {
        key = await deriveVaultKey(pin, account.salt);
      } catch {
        setPhase('locked');
        setError('Não foi possível preparar o cofre. Tente novamente.');
        return;
      }

      const valid = await verifyKey(account, key).catch(() => false);
      if (!valid) {
        setPhase('locked');
        setError('PIN incorreto.');
        return;
      }

      const existing = await readVault(account.id);
      let db: Database;

      if (existing) {
        let bytes: Uint8Array;
        try {
          bytes = await decryptVault(key, existing);
        } catch {
          setPhase('locked');
          setError('Não foi possível abrir o cofre local. Verifique o PIN.');
          return;
        }
        db = await createDatabase(bytes);
      } else {
        // Conta existe, mas a cópia local sumiu (ex.: dados do navegador limpos).
        db = await createDatabase();
        seedVault(db);
      }

      const nextUser: AppUser = { id: account.id, username: account.username };
      dbRef.current = db;
      keyRef.current = key;
      userRef.current = nextUser;
      await enqueueSave();

      finishUnlock(db, key, nextUser, account.salt);
    },
    [enqueueSave, finishUnlock],
  );

  const register = useCallback(
    async (username: string, pin: string) => {
      const normalized = username.trim();
      setPhase('loading');
      setError(null);

      try {
        const salt = randomBase64(16);
        const key = await deriveVaultKey(pin, salt);
        const account = await createAccount(normalized, salt, key);

        const db = await createDatabase();
        seedVault(db);

        const nextUser: AppUser = { id: account.id, username: account.username };
        dbRef.current = db;
        keyRef.current = key;
        userRef.current = nextUser;
        await enqueueSave();

        finishUnlock(db, key, nextUser, salt);
      } catch (registerError) {
        setPhase('locked');
        setError(
          registerError instanceof Error
            ? registerError.message
            : 'Não foi possível criar seu cofre.',
        );
      }
    },
    [enqueueSave, finishUnlock],
  );

  const logout = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await enqueueSave();

    dbRef.current?.close();
    dbRef.current = null;
    keyRef.current = null;
    userRef.current = null;
    setUser(null);
    setPhase('locked');
    setVersion(0);
    setSavedAt(null);
    navigate('/', { replace: true });
  }, [enqueueSave, navigate]);

  const downloadBackup = useCallback(() => {
    const db = dbRef.current;
    const currentUser = userRef.current;
    if (!db || !currentUser) return;
    const payload = exportData(db);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `aurum-${currentUser.username.toLowerCase().replace(/\s+/g, '-')}-${todayISO()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, []);

  const importBackup = useCallback(
    async (file: File) => {
      const db = dbRef.current;
      if (!db) throw new Error('O cofre não está aberto.');
      const text = await file.text();

      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('O arquivo não é um JSON válido.');
      }

      const count = importData(db, payload);
      if (count === 0) throw new Error('Nenhum registro encontrado no arquivo.');

      setVersion((current) => current + 1);
      await enqueueSave();
      return count;
    },
    [enqueueSave],
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const flush = () => {
      if (phase === 'ready') void enqueueSave();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enqueueSave, phase]);

  const clearError = useCallback(() => setError(null), []);

  const value: AppContextValue = {
    phase,
    user,
    lastUsername,
    db: (dbRef.current ?? null) as Database,
    version,
    savedAt,
    online,
    error,
    register,
    unlock,
    logout,
    bump,
    downloadBackup,
    importBackup,
    clearError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp precisa estar dentro de AppProvider.');
  return context;
}
