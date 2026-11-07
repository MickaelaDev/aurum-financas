export type Entity =
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'recurring_bills'
  | 'salary_profile'
  | 'deductions';

export type AccountType = 'checking' | 'savings' | 'cash' | 'investment' | 'other';
export type CategoryKind = 'income' | 'expense';
export type TransactionType = 'income' | 'expense';
export type DeductionKind = 'inss' | 'crediario' | 'other';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  color: string;
  archived: number;
  created_at: number;
  updated_at: number;
  deleted: number;
};

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  archived: number;
  created_at: number;
  updated_at: number;
  deleted: number;
};

export type Transaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
  notes: string;
  recurring_id: string | null;
  salary_month: string | null;
  created_at: number;
  updated_at: number;
  deleted: number;
};

export type Budget = {
  id: string;
  month: string;
  category_id: string;
  amount: number;
  created_at: number;
  updated_at: number;
  deleted: number;
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline: string | null;
  created_at: number;
  updated_at: number;
  deleted: number;
};

export type RecurringBill = {
  id: string;
  name: string;
  category_id: string | null;
  account_id: string | null;
  amount: number;
  due_day: number;
  start_month: string;
  active: number;
  created_at: number;
  updated_at: number;
  deleted: number;
};

export type SalaryProfile = {
  id: string;
  gross: number;
  payment_day: number;
  created_at: number;
  updated_at: number;
  deleted: number;
};

export type Deduction = {
  id: string;
  name: string;
  kind: DeductionKind;
  amount: number;
  active: number;
  created_at: number;
  updated_at: number;
  deleted: number;
};

export type AccountWithBalance = Account & {
  balance: number;
  movements: number;
};

export type TransactionView = Transaction & {
  category_name: string | null;
  category_color: string | null;
  account_name: string | null;
};

export type BudgetView = Budget & {
  category_name: string;
  category_color: string;
  spent: number;
};

export type RecurringView = RecurringBill & {
  category_name: string | null;
  category_color: string | null;
  account_name: string | null;
  paid_transaction_id: string | null;
};

export type CategorySpend = {
  id: string;
  name: string;
  color: string;
  spent: number;
};

export type TransactionFilters = {
  month?: string | null;
  type?: TransactionType | null;
  accountId?: string | null;
  categoryId?: string | null;
  search?: string | null;
  limit?: number;
};

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error'
  | 'auth';

export type SyncState = {
  status: SyncStatus;
  lastSyncAt: number | null;
  pending: number;
  message?: string;
};

export type AppUser = {
  id: string;
  username: string;
};
