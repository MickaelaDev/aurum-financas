import type { Database } from 'sql.js';
import { all, one, putRecord, softDelete } from './db';
import { monthLabel } from './date';
import type {
  Account,
  AccountWithBalance,
  Budget,
  BudgetView,
  Category,
  CategorySpend,
  Deduction,
  Goal,
  RecurringBill,
  RecurringView,
  SalaryProfile,
  Transaction,
  TransactionFilters,
  TransactionView,
} from './types';

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function listAccounts(db: Database, includeArchived = false): AccountWithBalance[] {
  const filter = includeArchived ? '' : 'AND a.archived = 0';
  return all<AccountWithBalance>(
    db,
    `SELECT a.*,
       a.initial_balance + COALESCE(SUM(CASE
         WHEN t.type = 'income' THEN t.amount
         WHEN t.type = 'expense' THEN -t.amount
         ELSE 0 END), 0) AS balance,
       COUNT(t.id) AS movements
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted = 0
     WHERE a.deleted = 0 ${filter}
     GROUP BY a.id
     ORDER BY a.archived ASC, a.created_at ASC`,
  );
}

export function totalBalance(db: Database): number {
  const row = one<{ total: number }>(
    db,
    `SELECT COALESCE(SUM(balance), 0) AS total FROM (
       SELECT a.id,
         a.initial_balance + COALESCE(SUM(CASE
           WHEN t.type = 'income' THEN t.amount
           WHEN t.type = 'expense' THEN -t.amount
           ELSE 0 END), 0) AS balance
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted = 0
       WHERE a.deleted = 0 AND a.archived = 0
       GROUP BY a.id
     )`,
  );
  return row?.total ?? 0;
}

export function listCategories(db: Database, includeArchived = false): Category[] {
  const filter = includeArchived ? '' : 'AND archived = 0';
  return all<Category>(
    db,
    `SELECT * FROM categories WHERE deleted = 0 ${filter}
     ORDER BY kind ASC, name COLLATE NOCASE ASC`,
  );
}

export function findCategoryByName(db: Database, name: string): Category | null {
  return one<Category>(
    db,
    'SELECT * FROM categories WHERE deleted = 0 AND lower(name) = lower(?) LIMIT 1',
    [name],
  );
}

export function listTransactions(db: Database, filters: TransactionFilters = {}): TransactionView[] {
  const conditions = ['t.deleted = 0'];
  const params: Array<string | number> = [];

  if (filters.month) {
    conditions.push('substr(t.date, 1, 7) = ?');
    params.push(filters.month);
  }
  if (filters.type) {
    conditions.push('t.type = ?');
    params.push(filters.type);
  }
  if (filters.accountId) {
    conditions.push('t.account_id = ?');
    params.push(filters.accountId);
  }
  if (filters.categoryId) {
    conditions.push('t.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.search) {
    conditions.push("(t.description LIKE ? OR COALESCE(t.notes, '') LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term);
  }

  const limit = Math.min(Math.max(filters.limit ?? 500, 1), 2000);
  params.push(limit);

  return all<TransactionView>(
    db,
    `SELECT t.*, c.name AS category_name, c.color AS category_color, a.name AS account_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT ?`,
    params,
  );
}

export function getTransaction(db: Database, id: string): Transaction | null {
  return one<Transaction>(db, 'SELECT * FROM transactions WHERE id = ?', [id]);
}

export function recentTransactions(db: Database, limit = 7): TransactionView[] {
  return listTransactions(db, { limit });
}

export function transactionsBetween(
  db: Database,
  start: string,
  end: string,
): Transaction[] {
  return all<Transaction>(
    db,
    `SELECT * FROM transactions
     WHERE deleted = 0 AND date >= ? AND date <= ?
     ORDER BY date ASC, created_at ASC`,
    [start, end],
  );
}

export function monthTotals(db: Database, month: string): { income: number; expense: number } {
  const row = one<{ income: number; expense: number }>(
    db,
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
     FROM transactions
     WHERE deleted = 0 AND substr(date, 1, 7) = ?`,
    [month],
  );
  return { income: row?.income ?? 0, expense: row?.expense ?? 0 };
}

export function categorySpending(
  db: Database,
  month: string,
  type: 'income' | 'expense' = 'expense',
): CategorySpend[] {
  return all<CategorySpend>(
    db,
    `SELECT c.id, c.name, c.color, COALESCE(SUM(t.amount), 0) AS spent
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id
       AND t.deleted = 0 AND t.type = ? AND substr(t.date, 1, 7) = ?
     WHERE c.deleted = 0 AND c.kind = ? AND c.archived = 0
     GROUP BY c.id
     ORDER BY spent DESC, c.name ASC`,
    [type, month, type],
  );
}

export function listBudgets(db: Database, month: string): BudgetView[] {
  return all<BudgetView>(
    db,
    `SELECT b.*, c.name AS category_name, c.color AS category_color,
       COALESCE((
         SELECT SUM(t.amount) FROM transactions t
         WHERE t.deleted = 0 AND t.type = 'expense'
           AND t.category_id = b.category_id AND substr(t.date, 1, 7) = b.month
       ), 0) AS spent
     FROM budgets b
     JOIN categories c ON c.id = b.category_id AND c.deleted = 0
     WHERE b.deleted = 0 AND b.month = ?
     ORDER BY c.name COLLATE NOCASE ASC`,
    [month],
  );
}

export function listGoals(db: Database): Goal[] {
  return all<Goal>(
    db,
    `SELECT * FROM goals WHERE deleted = 0
     ORDER BY (saved >= target) ASC, created_at DESC`,
  );
}

export function listRecurring(db: Database, month: string): RecurringView[] {
  return all<RecurringView>(
    db,
    `SELECT r.*, c.name AS category_name, c.color AS category_color, a.name AS account_name,
       (SELECT t.id FROM transactions t
        WHERE t.deleted = 0 AND t.recurring_id = r.id AND substr(t.date, 1, 7) = ?
        LIMIT 1) AS paid_transaction_id
     FROM recurring_bills r
     LEFT JOIN categories c ON c.id = r.category_id AND c.deleted = 0
     LEFT JOIN accounts a ON a.id = r.account_id AND a.deleted = 0
     WHERE r.deleted = 0
     ORDER BY r.active DESC, r.due_day ASC, r.name COLLATE NOCASE ASC`,
    [month],
  );
}

export function getSalaryProfile(db: Database): SalaryProfile | null {
  return one<SalaryProfile>(db, 'SELECT * FROM salary_profile WHERE deleted = 0 LIMIT 1');
}

export function listDeductions(db: Database): Deduction[] {
  return all<Deduction>(
    db,
    'SELECT * FROM deductions WHERE deleted = 0 ORDER BY active DESC, created_at ASC',
  );
}

export function getSalaryTransaction(db: Database, month: string): Transaction | null {
  return one<Transaction>(
    db,
    'SELECT * FROM transactions WHERE deleted = 0 AND salary_month = ? ORDER BY created_at DESC LIMIT 1',
    [month],
  );
}

export function listSalaryHistory(db: Database, limit = 12): TransactionView[] {
  return all<TransactionView>(
    db,
    `SELECT t.*, c.name AS category_name, c.color AS category_color, a.name AS account_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE t.deleted = 0 AND t.salary_month IS NOT NULL
     ORDER BY t.date DESC
     LIMIT ?`,
    [limit],
  );
}

export function defaultAccountId(db: Database): string | null {
  const account = one<Account>(
    db,
    'SELECT * FROM accounts WHERE deleted = 0 AND archived = 0 ORDER BY created_at ASC LIMIT 1',
  );
  return account?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function saveAccount(
  db: Database,
  input: {
    id?: string;
    name: string;
    type: Account['type'];
    initial_balance: number;
    color: string;
    archived?: number;
  },
): Account {
  const now = Date.now();
  const existing = input.id
    ? one<Account>(db, 'SELECT * FROM accounts WHERE id = ?', [input.id])
    : null;

  const record: Account = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    type: input.type,
    initial_balance: Math.round(input.initial_balance),
    color: input.color,
    archived: input.archived ?? existing?.archived ?? 0,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted: 0,
  };

  putRecord(db, 'accounts', record);
  return record;
}

export function setAccountArchived(db: Database, account: Account, archived: boolean): void {
  putRecord(db, 'accounts', { ...account, archived: archived ? 1 : 0 });
}

export function saveCategory(
  db: Database,
  input: { id?: string; name: string; kind: Category['kind']; color: string; archived?: number },
): Category {
  const now = Date.now();
  const existing = input.id
    ? one<Category>(db, 'SELECT * FROM categories WHERE id = ?', [input.id])
    : null;

  const record: Category = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    kind: input.kind,
    color: input.color,
    archived: input.archived ?? existing?.archived ?? 0,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted: 0,
  };

  putRecord(db, 'categories', record);
  return record;
}

export function setCategoryArchived(db: Database, category: Category, archived: boolean): void {
  putRecord(db, 'categories', { ...category, archived: archived ? 1 : 0 });
}

export function saveTransaction(
  db: Database,
  input: {
    id?: string;
    account_id: string;
    category_id: string | null;
    type: Transaction['type'];
    amount: number;
    date: string;
    description: string;
    notes?: string;
    recurring_id?: string | null;
    salary_month?: string | null;
  },
): Transaction {
  const now = Date.now();
  const existing = input.id
    ? one<Transaction>(db, 'SELECT * FROM transactions WHERE id = ?', [input.id])
    : null;

  const record: Transaction = {
    id: input.id ?? crypto.randomUUID(),
    account_id: input.account_id,
    category_id: input.category_id,
    type: input.type,
    amount: Math.round(input.amount),
    date: input.date,
    description: input.description.trim(),
    notes: input.notes?.trim() ?? existing?.notes ?? '',
    recurring_id: input.recurring_id ?? existing?.recurring_id ?? null,
    salary_month: input.salary_month ?? existing?.salary_month ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted: 0,
  };

  putRecord(db, 'transactions', record);
  return record;
}

export function deleteTransaction(db: Database, id: string): void {
  softDelete(db, 'transactions', id);
}

export function saveBudget(
  db: Database,
  month: string,
  categoryId: string,
  amount: number,
): Budget | null {
  const existing = one<Budget>(
    db,
    'SELECT * FROM budgets WHERE month = ? AND category_id = ? AND deleted = 0 LIMIT 1',
    [month, categoryId],
  );

  if (amount <= 0) {
    if (existing) softDelete(db, 'budgets', existing.id);
    return null;
  }

  const now = Date.now();
  const record: Budget = existing
    ? { ...existing, amount: Math.round(amount) }
    : {
        id: crypto.randomUUID(),
        month,
        category_id: categoryId,
        amount: Math.round(amount),
        created_at: now,
        updated_at: now,
        deleted: 0,
      };

  putRecord(db, 'budgets', record);
  return record;
}

export function copyBudgets(db: Database, fromMonth: string, toMonth: string): number {
  const source = listBudgets(db, fromMonth);
  let copied = 0;
  for (const budget of source) {
    const existing = one<Budget>(
      db,
      'SELECT * FROM budgets WHERE month = ? AND category_id = ? AND deleted = 0 LIMIT 1',
      [toMonth, budget.category_id],
    );
    if (existing) continue;
    saveBudget(db, toMonth, budget.category_id, budget.amount);
    copied += 1;
  }
  return copied;
}

export function saveGoal(
  db: Database,
  input: {
    id?: string;
    name: string;
    target: number;
    saved: number;
    deadline: string | null;
  },
): Goal {
  const now = Date.now();
  const existing = input.id
    ? one<Goal>(db, 'SELECT * FROM goals WHERE id = ?', [input.id])
    : null;

  const record: Goal = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    target: Math.round(input.target),
    saved: Math.round(input.saved),
    deadline: input.deadline || null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted: 0,
  };

  putRecord(db, 'goals', record);
  return record;
}

export function addGoalContribution(db: Database, goal: Goal, amount: number): Goal {
  const record: Goal = { ...goal, saved: Math.max(0, goal.saved + Math.round(amount)) };
  putRecord(db, 'goals', record);
  return record;
}

export function deleteGoal(db: Database, id: string): void {
  softDelete(db, 'goals', id);
}

export function saveRecurring(
  db: Database,
  input: {
    id?: string;
    name: string;
    category_id: string | null;
    account_id: string | null;
    amount: number;
    due_day: number;
    start_month: string;
    active?: number;
  },
): RecurringBill {
  const now = Date.now();
  const existing = input.id
    ? one<RecurringBill>(db, 'SELECT * FROM recurring_bills WHERE id = ?', [input.id])
    : null;

  const record: RecurringBill = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    category_id: input.category_id,
    account_id: input.account_id,
    amount: Math.round(input.amount),
    due_day: Math.min(Math.max(Math.round(input.due_day), 1), 31),
    start_month: input.start_month,
    active: input.active ?? existing?.active ?? 1,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted: 0,
  };

  putRecord(db, 'recurring_bills', record);
  return record;
}

export function setRecurringActive(
  db: Database,
  bill: RecurringBill,
  active: boolean,
): void {
  putRecord(db, 'recurring_bills', { ...bill, active: active ? 1 : 0 });
}

export function deleteRecurring(db: Database, id: string): void {
  softDelete(db, 'recurring_bills', id);
}

export function payRecurring(
  db: Database,
  bill: RecurringBill,
  month: string,
): { transaction: Transaction; created: boolean } {
  const existing = one<Transaction>(
    db,
    'SELECT * FROM transactions WHERE deleted = 0 AND recurring_id = ? AND substr(date, 1, 7) = ? LIMIT 1',
    [bill.id, month],
  );
  if (existing) return { transaction: existing, created: false };

  const accountId = bill.account_id ?? defaultAccountId(db) ?? '';
  const day = Math.min(bill.due_day, 28);
  const transaction = saveTransaction(db, {
    account_id: accountId,
    category_id: bill.category_id,
    type: 'expense',
    amount: bill.amount,
    date: `${month}-${String(day).padStart(2, '0')}`,
    description: bill.name,
    notes: 'Conta recorrente',
    recurring_id: bill.id,
  });
  return { transaction, created: true };
}

export function saveSalaryProfile(
  db: Database,
  input: { gross: number; payment_day: number },
): SalaryProfile {
  const now = Date.now();
  const existing = getSalaryProfile(db);
  const record: SalaryProfile = {
    id: existing?.id ?? 'salary-profile',
    gross: Math.round(input.gross),
    payment_day: Math.min(Math.max(Math.round(input.payment_day), 1), 31),
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted: 0,
  };
  putRecord(db, 'salary_profile', record);
  return record;
}

export function saveDeduction(
  db: Database,
  input: {
    id?: string;
    name: string;
    kind: Deduction['kind'];
    amount: number;
    active?: number;
  },
): Deduction {
  const now = Date.now();
  const existing = input.id
    ? one<Deduction>(db, 'SELECT * FROM deductions WHERE id = ?', [input.id])
    : null;

  const record: Deduction = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    kind: input.kind,
    amount: Math.round(input.amount),
    active: input.active ?? existing?.active ?? 1,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted: 0,
  };

  putRecord(db, 'deductions', record);
  return record;
}

export function setDeductionActive(
  db: Database,
  deduction: Deduction,
  active: boolean,
): void {
  putRecord(db, 'deductions', { ...deduction, active: active ? 1 : 0 });
}

export function deleteDeduction(db: Database, id: string): void {
  softDelete(db, 'deductions', id);
}

export function registerSalary(
  db: Database,
  input: {
    month: string;
    net: number;
    gross: number;
    deductionsTotal: number;
    paymentDay: number;
    accountId: string;
    categoryId: string | null;
  },
): Transaction {
  const existing = getSalaryTransaction(db, input.month);
  const category =
    input.categoryId ??
    one<Category>(
      db,
      "SELECT * FROM categories WHERE deleted = 0 AND kind = 'income' AND lower(name) LIKE '%sal%' LIMIT 1",
    )?.id ??
    null;
  const day = Math.min(input.paymentDay, 28);

  return saveTransaction(db, {
    id: existing?.id,
    account_id: input.accountId,
    category_id: category,
    type: 'income',
    amount: input.net,
    date: `${input.month}-${String(day).padStart(2, '0')}`,
    description: `Salário · ${monthLabel(input.month)}`,
    notes: `Bruto ${(input.gross / 100).toFixed(2)} · Descontos ${(input.deductionsTotal / 100).toFixed(2)}`,
    salary_month: input.month,
  });
}

export function salarySummary(
  profile: SalaryProfile | null,
  deductions: Deduction[],
): {
  gross: number;
  deductionsTotal: number;
  net: number;
  inss: number;
  crediario: number;
  other: number;
  activeDeductions: Deduction[];
} {
  const activeDeductions = deductions.filter((item) => item.active === 1);
  const gross = profile?.gross ?? 0;
  const inss = activeDeductions
    .filter((item) => item.kind === 'inss')
    .reduce((sum, item) => sum + item.amount, 0);
  const crediario = activeDeductions
    .filter((item) => item.kind === 'crediario')
    .reduce((sum, item) => sum + item.amount, 0);
  const other = activeDeductions
    .filter((item) => item.kind === 'other')
    .reduce((sum, item) => sum + item.amount, 0);
  const deductionsTotal = inss + crediario + other;

  return {
    gross,
    deductionsTotal,
    net: gross - deductionsTotal,
    inss,
    crediario,
    other,
    activeDeductions,
  };
}
