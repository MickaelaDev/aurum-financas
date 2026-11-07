import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, Search, Trash2, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { currentMonthKey, formatDateShort, weekdayShort } from '../lib/date';
import { formatBRL } from '../lib/money';
import {
  deleteTransaction,
  listAccounts,
  listCategories,
  listTransactions,
} from '../lib/repo';
import type { Transaction, TransactionType } from '../lib/types';
import {
  Button,
  ConfirmDialog,
  Dot,
  EmptyState,
  Field,
  IconButton,
  MonthSwitcher,
  PageHeader,
  Select,
  useToast,
} from '../components/ui';
import { TransactionModal } from '../components/TransactionModal';

type TypeFilter = 'all' | TransactionType;

export function Transactions() {
  const { db, version, bump } = useApp();
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [type, setType] = useState<TypeFilter>('all');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [txOpen, setTxOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const accounts = useMemo(() => listAccounts(db, true), [db, version]);
  const categories = useMemo(() => listCategories(db, true), [db, version]);

  const transactions = useMemo(
    () =>
      listTransactions(db, {
        month,
        type: type === 'all' ? null : type,
        accountId: accountId || null,
        categoryId: categoryId || null,
        search: search.trim() || null,
        limit: 900,
      }),
    [db, version, month, type, accountId, categoryId, search],
  );

  const filteredCategories = categories.filter(
    (category) => type === 'all' || category.kind === type,
  );

  const income = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const hasFilters = type !== 'all' || Boolean(accountId) || Boolean(categoryId) || Boolean(search);

  function clearFilters() {
    setType('all');
    setAccountId('');
    setCategoryId('');
    setSearch('');
  }

  function openNew() {
    setEditing(null);
    setTxOpen(true);
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setTxOpen(true);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Movimentações"
        title="Transações"
        description="Cada entrada e saída, organizada por mês, conta e categoria."
        actions={
          <>
            <MonthSwitcher value={month} onChange={setMonth} />
            <Button icon={<Plus size={15} />} onClick={openNew}>
              Nova transação
            </Button>
          </>
        }
      />

      <section className="filter-summary">
        <div className="filter-summary__item">
          <span className="mini-pair__label">
            <ArrowDownLeft size={12} /> Entradas
          </span>
          <strong className="is-gold">{formatBRL(income)}</strong>
        </div>
        <div className="filter-summary__item">
          <span className="mini-pair__label">
            <ArrowUpRight size={12} /> Saídas
          </span>
          <strong className="is-wine">{formatBRL(expense)}</strong>
        </div>
        <div className="filter-summary__item">
          <span className="mini-pair__label">Resultado</span>
          <strong className={income - expense < 0 ? 'is-wine' : ''}>{formatBRL(income - expense)}</strong>
        </div>
        <div className="filter-summary__count">
          {transactions.length} {transactions.length === 1 ? 'lançamento' : 'lançamentos'}
          {hasFilters ? ' no filtro' : ''}
        </div>
      </section>

      <section className="panel filter-panel">
        <div className="filter-bar">
          <div className="search-box">
            <Search size={15} />
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por descrição ou observação"
              aria-label="Buscar transações"
            />
          </div>
          <Field label="Tipo" htmlFor="filter-type">
            <Select
              id="filter-type"
              value={type}
              onChange={(event) => {
                const next = event.target.value as TypeFilter;
                setType(next);
                setCategoryId('');
              }}
            >
              <option value="all">Todos</option>
              <option value="income">Entradas</option>
              <option value="expense">Saídas</option>
            </Select>
          </Field>
          <Field label="Categoria" htmlFor="filter-category">
            <Select
              id="filter-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Todas</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Conta" htmlFor="filter-account">
            <Select
              id="filter-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Todas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
          {hasFilters ? (
            <button type="button" className="filter-clear" onClick={clearFilters}>
              <X size={13} /> Limpar
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel panel--flush">
        {transactions.length > 0 ? (
          <div className="tx-list">
            <div className="tx-head">
              <span>Data</span>
              <span>Descrição</span>
              <span>Categoria</span>
              <span>Conta</span>
              <span className="is-right">Valor</span>
              <span />
            </div>
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="tx-row"
                role="button"
                tabIndex={0}
                onClick={() => openEdit(transaction)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openEdit(transaction);
                  }
                }}
              >
                <span className="tx-date">
                  {formatDateShort(transaction.date)}
                  <small>{weekdayShort(transaction.date)}</small>
                </span>
                <span className="tx-desc">
                  <strong>{transaction.description}</strong>
                  {transaction.notes ? <small>{transaction.notes}</small> : null}
                </span>
                <span className="tx-cat">
                  {transaction.category_name ? (
                    <>
                      <Dot color={transaction.category_color ?? '#6b655c'} />
                      {transaction.category_name}
                    </>
                  ) : (
                    <span className="is-muted">Sem categoria</span>
                  )}
                </span>
                <span className="tx-account">{transaction.account_name ?? '—'}</span>
                <span className={`tx-amount ${transaction.type === 'income' ? 'is-gold' : 'is-wine'}`}>
                  {transaction.type === 'income' ? '+' : '−'} {formatBRL(transaction.amount)}
                </span>
                <span className="tx-actions">
                  <IconButton
                    label="Excluir transação"
                    tone="danger"
                    icon={<Trash2 size={15} />}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleting(transaction);
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title={hasFilters ? 'Nenhum resultado' : 'Mês sem movimentações'}
            description={
              hasFilters
                ? 'Ajuste os filtros para encontrar o que procura.'
                : 'Registre sua primeira entrada ou saída deste mês.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              ) : (
                <Button size="sm" onClick={openNew}>
                  Nova transação
                </Button>
              )
            }
          />
        )}
      </section>

      <TransactionModal
        open={txOpen}
        onClose={() => {
          setTxOpen(false);
          setEditing(null);
        }}
        transaction={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir transação"
        description="Esta movimentação deixará de contar nos saldos e relatórios."
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteTransaction(db, deleting.id);
          bump();
          toast('Transação excluída.', 'info');
          setDeleting(null);
        }}
      />
    </div>
  );
}
