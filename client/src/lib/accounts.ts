import { decryptText, encryptText } from './crypto';
import { readAccounts, writeAccount, type StoredAccount } from './idb';

export type LocalAccount = StoredAccount;

/**
 * Texto de conferência cifrado com a chave derivada do PIN.
 * Permite validar o PIN sem depender de servidor e sem guardar o PIN.
 */
const VERIFIER_TEXT = 'aurum:vault-check';

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function listAccounts(): Promise<LocalAccount[]> {
  const accounts = await readAccounts();
  return [...accounts].sort((a, b) => a.createdAt - b.createdAt);
}

export async function findAccount(username: string): Promise<LocalAccount | null> {
  const normalized = normalizeUsername(username);
  const accounts = await readAccounts();
  return accounts.find((account) => account.usernameNorm === normalized) ?? null;
}

export async function createAccount(
  username: string,
  salt: string,
  key: CryptoKey,
): Promise<LocalAccount> {
  const name = username.trim();
  if (await findAccount(name)) {
    throw new Error('Já existe um cofre com esse nome neste navegador.');
  }

  const account: LocalAccount = {
    id: crypto.randomUUID(),
    username: name,
    usernameNorm: normalizeUsername(name),
    salt,
    verifier: await encryptText(key, VERIFIER_TEXT),
    createdAt: Date.now(),
  };

  await writeAccount(account);
  return account;
}

export async function verifyKey(account: LocalAccount, key: CryptoKey): Promise<boolean> {
  if (!account.verifier) return true;
  try {
    return (await decryptText(key, account.verifier)) === VERIFIER_TEXT;
  } catch {
    return false;
  }
}
