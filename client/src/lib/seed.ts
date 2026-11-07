import { putRecord } from './db';
import type { Database } from 'sql.js';

const CATEGORIES: Array<{ name: string; kind: 'income' | 'expense'; color: string }> = [
  { name: 'Salário', kind: 'income', color: '#c9a86a' },
  { name: 'Freelance', kind: 'income', color: '#b8a07a' },
  { name: 'Rendimentos', kind: 'income', color: '#8a8f6a' },
  { name: 'Moradia', kind: 'expense', color: '#9b5f55' },
  { name: 'Alimentação', kind: 'expense', color: '#b98a5e' },
  { name: 'Transporte', kind: 'expense', color: '#6b7a86' },
  { name: 'Saúde', kind: 'expense', color: '#8f7f6a' },
  { name: 'Lazer', kind: 'expense', color: '#a06c7a' },
  { name: 'Educação', kind: 'expense', color: '#7a8a7f' },
  { name: 'Assinaturas', kind: 'expense', color: '#8c7446' },
  { name: 'Outros', kind: 'expense', color: '#6b655c' },
];

export function seedVault(db: Database): void {
  const now = Date.now();

  for (const category of CATEGORIES) {
    putRecord(db, 'categories', {
      id: crypto.randomUUID(),
      name: category.name,
      kind: category.kind,
      color: category.color,
      archived: 0,
      created_at: now,
      updated_at: now,
      deleted: 0,
    });
  }

  putRecord(db, 'accounts', {
    id: crypto.randomUUID(),
    name: 'Conta principal',
    type: 'checking',
    initial_balance: 0,
    color: '#c9a86a',
    archived: 0,
    created_at: now,
    updated_at: now,
    deleted: 0,
  });
}
