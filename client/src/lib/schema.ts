import type { Entity } from './types';

export const APP_NAME = 'Aurum';

export const ENTITY_COLUMNS: Record<Entity, string[]> = {
  accounts: [
    'id',
    'name',
    'type',
    'initial_balance',
    'color',
    'archived',
    'created_at',
    'updated_at',
    'deleted',
  ],
  categories: ['id', 'name', 'kind', 'color', 'archived', 'created_at', 'updated_at', 'deleted'],
  transactions: [
    'id',
    'account_id',
    'category_id',
    'type',
    'amount',
    'date',
    'description',
    'notes',
    'recurring_id',
    'salary_month',
    'created_at',
    'updated_at',
    'deleted',
  ],
  budgets: ['id', 'month', 'category_id', 'amount', 'created_at', 'updated_at', 'deleted'],
  goals: ['id', 'name', 'target', 'saved', 'deadline', 'created_at', 'updated_at', 'deleted'],
  recurring_bills: [
    'id',
    'name',
    'category_id',
    'account_id',
    'amount',
    'due_day',
    'start_month',
    'active',
    'created_at',
    'updated_at',
    'deleted',
  ],
  salary_profile: ['id', 'gross', 'payment_day', 'created_at', 'updated_at', 'deleted'],
  deductions: [
    'id',
    'name',
    'kind',
    'amount',
    'active',
    'created_at',
    'updated_at',
    'deleted',
  ],
};

export const ENTITIES = Object.keys(ENTITY_COLUMNS) as Entity[];

export const ENTITY_TABLE: Record<Entity, string> = {
  accounts: 'accounts',
  categories: 'categories',
  transactions: 'transactions',
  budgets: 'budgets',
  goals: 'goals',
  recurring_bills: 'recurring_bills',
  salary_profile: 'salary_profile',
  deductions: 'deductions',
};

export const SCHEMA = `
PRAGMA journal_mode = MEMORY;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'checking',
  initial_balance INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#c9a86a',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'expense',
  color TEXT NOT NULL DEFAULT '#c9a86a',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  category_id TEXT,
  type TEXT NOT NULL DEFAULT 'expense',
  amount INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  recurring_id TEXT,
  salary_month TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  category_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  target INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  deadline TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recurring_bills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  category_id TEXT,
  account_id TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  due_day INTEGER NOT NULL DEFAULT 1,
  start_month TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS salary_profile (
  id TEXT PRIMARY KEY,
  gross INTEGER NOT NULL DEFAULT 0,
  payment_day INTEGER NOT NULL DEFAULT 5,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deductions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'other',
  amount INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS _changes (
  entity TEXT NOT NULL,
  record_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (entity, record_id)
);
`;
