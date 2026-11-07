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
import { ApiError, api } from '../lib/api';
import { decryptVault, deriveVaultKey, encryptVault } from '../lib/crypto';
import { createDatabase, exportData, one, pendingCount } from '../lib/db';
import { readVault, writeVault } from '../lib/idb';
import { seedVault } from '../lib/seed';
import { pullInitial, SyncEngine } from '../lib/sync';
import type { AppUser, SyncState } from '../lib/types';
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
  sync: SyncState;
  online: boolean;
  error: string | null;
  register: (username: string, pin: string) => Promise<void>;
  unlock: (username: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  bump: () => void;
  syncNow: () => Promise<void>;
  resync: () => Promise<void>;
  downloadBackup: () => void;
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
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [sync, setSync] = useState<SyncState>({
    status: navigator.onLine ? 'idle' : 'offline',
    lastSyncAt: null,
    pending: 0,
  });

  const dbRef = useRef<Database | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const userRef = useRef<AppUser | null>(null);
  const syncRef = useRef<SyncEngine | null>(null);
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
    const db = dbRef.current;
    if (db) {
      setSync((current) => ({ ...current, pending: pendingCount(db) }));
    }
    scheduleSave();
    syncRef.current?.schedule(1200);
  }, [scheduleSave]);

  const startEngine = useCallback(
    (db: Database, key: CryptoKey) => {
      syncRef.current?.stop();
      const engine = new SyncEngine({
        db,
        key,
        onState: (state) => setSync(state),
        onApplied: () => {
          setVersion((current) => current + 1);
          scheduleSave();
        },
      });
      syncRef.current = engine;
      engine.start();
    },
    [scheduleSave],
  );

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
      startEngine(db, key);
      navigate('/', { replace: true });
    },
    [navigate, startEngine],
  );

  const unlock = useCallback(
    async (username: string, pin: string) => {
      const normalized = username.trim();
      setPhase('loading');
      setError(null);

      let authUser: AppUser;
      let salt: string;
      let offline = false;

      try {
        const response = await api.login(normalized, pin);
        authUser = response.user;
        salt = response.vaultSalt;
      } catch (authError) {
        if (authError instanceof ApiError && authError.offline) {
          offline = true;
          const cached = readLastUser();
          if (cached && cached.username.toLowerCase() === normalized.toLowerCase()) {
            authUser = { id: cached.userId, username: cached.username };
            salt = cached.salt;
          } else {
            setPhase('locked');
            setError(
              'Sem conexão. Entre uma vez com internet neste navegador para liberar o acesso offline.',
            );
            return;
          }
        } else {
          setPhase('locked');
          setError(authError instanceof Error ? authError.message : 'Não foi possível entrar.');
          return;
        }
      }

      let key: CryptoKey;
      try {
        key = await deriveVaultKey(pin, salt);
      } catch {
        setPhase('locked');
        setError('Não foi possível preparar o cofre. Tente novamente.');
        return;
      }

      const existing = await readVault(authUser.id);
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
        if (offline) {
          setPhase('locked');
          setError('Este navegador ainda não tem uma cópia local. Conecte-se para baixar seus dados.');
          return;
        }
        let created: Database | null = null;
        try {
          created = await createDatabase();
          await pullInitial(created, key);
          const total = one<{ total: number }>(
            created,
            'SELECT COUNT(*) AS total FROM categories',
          );
          if (!total || total.total === 0) seedVault(created);
        } catch (openError) {
          created?.close();
          setPhase('locked');
          setError(
            openError instanceof ApiError
              ? openError.message
              : 'Não foi possível baixar seus dados. Tente novamente.',
          );
          return;
        }
        if (!created) {
          setPhase('locked');
          setError('Não foi possível abrir o cofre local. Tente novamente.');
          return;
        }
        db = created;
        dbRef.current = db;
        keyRef.current = key;
        userRef.current = authUser;
        await enqueueSave();
      }

      finishUnlock(db, key, authUser, salt);
      if (existing) void enqueueSave();
    },
    [enqueueSave, finishUnlock],
  );

  const register = useCallback(
    async (username: string, pin: string) => {
      const normalized = username.trim();
      setPhase('loading');
      setError(null);

      try {
        const response = await api.register(normalized, pin);
        const key = await deriveVaultKey(pin, response.vaultSalt);
        const db = await createDatabase();
        seedVault(db);
        dbRef.current = db;
        keyRef.current = key;
        userRef.current = response.user;
        await enqueueSave();
        finishUnlock(db, key, response.user, response.vaultSalt);
      } catch (registerError) {
        setPhase('locked');
        setError(
          registerError instanceof Error
            ? registerError.message
            : 'Não foi possível criar sua conta.',
        );
      }
    },
    [enqueueSave, finishUnlock],
  );

  const logout = useCallback(async () => {
    syncRef.current?.stop();
    syncRef.current = null;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await enqueueSave();
    void api.logout().catch(() => undefined);

    dbRef.current?.close();
    dbRef.current = null;
    keyRef.current = null;
    userRef.current = null;
    setUser(null);
    setPhase('locked');
    setVersion(0);
    setSync({ status: navigator.onLine ? 'idle' : 'offline', lastSyncAt: null, pending: 0 });
    navigate('/', { replace: true });
  }, [enqueueSave, navigate]);

  const syncNow = useCallback(async () => {
    await syncRef.current?.syncNow();
  }, []);

  const resync = useCallback(async () => {
    await syncRef.current?.resyncAll();
    await enqueueSave();
  }, [enqueueSave]);

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

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      syncRef.current?.schedule(300);
    };
    const handleOffline = () => {
      setOnline(false);
      setSync((current) => ({ ...current, status: 'offline' }));
    };
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
    sync,
    online,
    error,
    register,
    unlock,
    logout,
    bump,
    syncNow,
    resync,
    downloadBackup,
    clearError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp precisa estar dentro de AppProvider.');
  return context;
}
