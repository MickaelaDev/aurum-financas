import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  PieChart,
  Plus,
  Target,
  Wallet,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import {
  clampDayToMonth,
  currentMonthKey,
  lastMonths,
  lastWeeks,
  lastYears,
  monthRange,
  relativeDateLabel,
  todayISO,
} from '../lib/date';
import { formatBRL, percent } from '../lib/money';
import {
  categorySpending,
  getSalaryProfile,
  getSalaryTransaction,
  listAccounts,
  listBudgets,
  listDeductions,
  listGoals,
  listRecurring,
  monthTotals,
  recentTransactions,
  salarySummary,
  totalBalance,
  transactionsBetween,
} from '../lib/repo';
import type { Transaction } from '../lib/types';
import {
  Badge,
  Button,
  EmptyState,
  MonthSwitcher,
  PageHeader,
  ProgressBar,
} from '../components/ui';
import { CashflowChart, ChartLegend, DonutChart, type CashflowPoint, type DonutSlice } from '../components/charts';
import { TransactionModal } from '../components/TransactionModal';

type ChartMode = 'semana' | 'mes' | 'ano';

const CHART_LABEL: Record<ChartMode, string> = {
  semana: 'Semanal',
  mes: 'Mensal',
  ano: 'Anual',
};

export function Dashboard() {
  const { db, version } = useApp();
  const [month, setMonth] = useState(currentMonthKey());
  const [chartMode, setChartMode] = useState<ChartMode>('mes');
  const [txOpen, setTxOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const accounts = useMemo(() => listAccounts(db), [db, version]);
  const balance = useMemo(() => totalBalance(db), [db, version]);
  const totals = useMemo(() => monthTotals(db, month), [db, version, month]);
  const profile = useMemo(() => getSalaryProfile(db), [db, version]);
  const deductions = useMemo(() => listDeductions(db), [db, version]);
  const summary = useMemo(() => salarySummary(profile, deductions), [profile, deductions]);
  const salaryTx = useMemo(() => getSalaryTransaction(db, month), [db, version, month]);
  const budgets = useMemo(() => listBudgets(db, month), [db, version, month]);
  const goals = useMemo(() => listGoals(db), [db, version]);
  const recurring = useMemo(() => listRecurring(db, month), [db, version, month]);
  const recent = useMemo(() => recentTransactions(db, 7), [db, version]);

  const monthNet = totals.income - totals.expense;
  const budgetTotal = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const budgetSpent = budgets.reduce((sum, budget) => sum + Math.min(budget.spent, budget.amount), 0);
  const budgetUsed = percent(budgetSpent, budgetTotal);
  const budgetOverspent = budgets.some((budget) => budget.spent > budget.amount);

  const chartData = useMemo<CashflowPoint[]>(() => {
    const buckets =
      chartMode === 'semana' ? lastWeeks(8) : chartMode === 'mes' ? lastMonths(12) : lastYears(5);
    const start = buckets[0]?.start ?? `${month}-01`;
    const end = buckets[buckets.length - 1]?.end ?? monthRange(month).end;
    const transactions = transactionsBetween(db, start, end);

    return buckets.map((bucket) => {
      let income = 0;
      let expense = 0;
      for (const transaction of transactions) {
        if (transaction.date < bucket.start || transaction.date > bucket.end) continue;
        if (transaction.type === 'income') income += transaction.amount;
        else expense += transaction.amount;
      }
      return { label: bucket.label, income, expense };
    });
  }, [db, version, chartMode, month]);

  const donutSlices = useMemo<DonutSlice[]>(() => {
    const spending = categorySpending(db, month, 'expense').filter((item) => item.spent > 0);
    const categorized = spending.reduce((sum, item) => sum + item.spent, 0);
    const uncategorized = Math.max(0, totals.expense - categorized);
    const top = spending.slice(0, 5);
    const rest = spending.slice(5).reduce((sum, item) => sum + item.spent, 0);
    const slices: DonutSlice[] = top.map((item) => ({
      name: item.name,
      value: item.spent,
      color: item.color,
    }));
    if (rest > 0) slices.push({ name: 'Demais', value: rest, color: '#5c5852' });
    if (uncategorized > 0) slices.push({ name: 'Sem categoria', value: uncategorized, color: '#3f3d39' });
    return slices;
  }, [db, version, month, totals.expense]);

  const upcoming = recurring
    .filter(
      (bill) =>
        bill.active === 1 &&
        !bill.paid_transaction_id &&
        bill.start_month <= month,
    )
    .slice(0, 4);
  const currentMonth = currentMonthKey();
  const today = todayISO();

  const topBudgets = [...budgets]
    .sort((a, b) => percent(b.spent, b.amount) - percent(a.spent, a.amount))
    .slice(0, 4);
  const topGoals = goals.slice(0, 3);

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
        eyebrow="Painel"
        title="Visão geral"
        description="O retrato do seu mês: o que entra, o que sai e o que fica."
        actions={
          <>
            <MonthSwitcher value={month} onChange={setMonth} />
            <Button icon={<Plus size={15} />} onClick={openNew}>
              Nova transação
            </Button>
          </>
        }
      />

      <section className="hero-grid">
        <article className="panel panel--gold salary-hero">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Salário</p>
              <h2 className="panel__title">Líquido previsto</h2>
            </div>
            {summary.gross > 0 ? (
              salaryTx ? (
                <Badge tone="olive">
                  <Check size={11} /> Recebido
                </Badge>
              ) : (
                <Badge tone="gold">A receber</Badge>
              )
            ) : null}
          </div>

          {summary.gross > 0 ? (
            <>
              <p className={`hero-value ${summary.net < 0 ? 'is-wine' : 'is-gold'}`}>
                {formatBRL(summary.net)}
              </p>
              <div className="hero-breakdown">
                <span>
                  Bruto <strong>{formatBRL(summary.gross)}</strong>
                </span>
                <span>
                  INSS <strong>− {formatBRL(summary.inss)}</strong>
                </span>
                <span>
                  Crediário <strong>− {formatBRL(summary.crediario)}</strong>
                </span>
                {summary.other > 0 ? (
                  <span>
                    Outros <strong>− {formatBRL(summary.other)}</strong>
                  </span>
                ) : null}
              </div>
              <div className="hero-foot">
                <span>
                  {salaryTx
                    ? `Recebido em ${relativeDateLabel(salaryTx.date)}`
                    : profile
                      ? `Previsto para o dia ${profile.payment_day}`
                      : 'Configure o dia de pagamento'}
                </span>
                <Link to="/salario" className="text-link">
                  Ajustar <ArrowRight size={13} />
                </Link>
              </div>
            </>
          ) : (
            <div className="hero-empty">
              <p>Defina seu salário bruto, o INSS e o crediário para saber exatamente quanto recebe.</p>
              <Link to="/salario" className="text-link">
                Configurar salário <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Patrimônio disponível</p>
              <h2 className="panel__title">Saldo em contas</h2>
            </div>
            <span className="panel__icon">
              <Wallet size={17} strokeWidth={1.3} />
            </span>
          </div>
          <p className="hero-value hero-value--ink">{formatBRL(balance)}</p>
          <p className="panel__sub">
            {accounts.length === 1 ? '1 conta ativa' : `${accounts.length} contas ativas`}
          </p>
          <div className="mini-pair">
            <div>
              <span className="mini-pair__label">
                <ArrowDownLeft size={12} /> Entradas
              </span>
              <strong className="is-gold">{formatBRL(totals.income)}</strong>
            </div>
            <div>
              <span className="mini-pair__label">
                <ArrowUpRight size={12} /> Saídas
              </span>
              <strong className="is-wine">{formatBRL(totals.expense)}</strong>
            </div>
          </div>
          <div className="hero-foot">
            <span>No mês selecionado</span>
            <Link to="/contas" className="text-link">
              Ver contas <ArrowRight size={13} />
            </Link>
          </div>
        </article>

        <article className="panel">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Resultado</p>
              <h2 className="panel__title">Saldo do mês</h2>
            </div>
          </div>
          <p className={`hero-value ${monthNet < 0 ? 'is-wine' : 'is-gold'}`}>
            {formatBRL(monthNet)}
          </p>
          <div className="month-bars">
            <div className="month-bars__row">
              <span>Entradas</span>
              <strong>{formatBRL(totals.income)}</strong>
            </div>
            <ProgressBar
              value={percent(totals.income, Math.max(totals.income, totals.expense))}
            />
            <div className="month-bars__row">
              <span>Saídas</span>
              <strong>{formatBRL(totals.expense)}</strong>
            </div>
            <ProgressBar
              value={percent(totals.expense, Math.max(totals.income, totals.expense))}
              tone="wine"
            />
          </div>
          <div className="hero-foot">
            <span>{monthNet >= 0 ? 'Sobrou neste mês' : 'Ficou negativo neste mês'}</span>
            <Link to="/transacoes" className="text-link">
              Movimentações <ArrowRight size={13} />
            </Link>
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--chart">
        <article className="panel">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Fluxo de caixa</p>
              <h2 className="panel__title">Entradas e saídas</h2>
              <p className="panel__sub">Compare os últimos períodos e veja a tendência.</p>
            </div>
            <div className="chart-tabs" role="group" aria-label="Período do gráfico">
              {(['semana', 'mes', 'ano'] as ChartMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={chartMode === mode ? 'is-active' : ''}
                  aria-pressed={chartMode === mode}
                  onClick={() => setChartMode(mode)}
                >
                  {CHART_LABEL[mode]}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-legend chart-legend--inline">
            <span className="chart-legend__item">
              <span className="dot" style={{ background: '#c9a86a' }} /> Entradas
            </span>
            <span className="chart-legend__item">
              <span className="dot" style={{ background: '#8f554c' }} /> Saídas
            </span>
          </div>
          <CashflowChart data={chartData} />
        </article>

        <article className="panel">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Composição</p>
              <h2 className="panel__title">Para onde foi</h2>
              <p className="panel__sub">Despesas por categoria.</p>
            </div>
            <span className="panel__icon">
              <PieChart size={17} strokeWidth={1.3} />
            </span>
          </div>
          {donutSlices.length > 0 ? (
            <>
              <DonutChart data={donutSlices} total={totals.expense} />
              <ChartLegend data={donutSlices.slice(0, 5)} />
              {donutSlices.length > 5 ? (
                <p className="panel__sub panel__sub--right">
                  + {donutSlices.length - 5} categorias no gráfico
                </p>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={PieChart}
              title="Sem despesas no mês"
              description="Quando houver gastos, a composição por categoria aparece aqui."
            />
          )}
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--split">
        <article className="panel">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Movimentações</p>
              <h2 className="panel__title">Recentes</h2>
            </div>
            <Link to="/transacoes" className="panel__link">
              Ver todas
            </Link>
          </div>
          {recent.length > 0 ? (
            <div className="recent-list">
              {recent.map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  className="recent-row"
                  onClick={() => openEdit(transaction)}
                >
                  <span className="recent-row__date">{relativeDateLabel(transaction.date)}</span>
                  <span className="recent-row__main">
                    <strong>{transaction.description}</strong>
                    <small>
                      {transaction.category_name ?? 'Sem categoria'}
                      {transaction.account_name ? ` · ${transaction.account_name}` : ''}
                    </small>
                  </span>
                  <span
                    className={`recent-row__amount ${
                      transaction.type === 'income' ? 'is-gold' : 'is-wine'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '−'} {formatBRL(transaction.amount)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ArrowUpRight}
              title="Nada por enquanto"
              description="Registre a primeira movimentação do mês para começar."
              action={
                <Button size="sm" variant="secondary" onClick={openNew}>
                  Nova transação
                </Button>
              }
            />
          )}
        </article>

        <article className="panel">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Agenda</p>
              <h2 className="panel__title">Próximos vencimentos</h2>
            </div>
            <Link to="/recorrentes" className="panel__link">
              Gerenciar
            </Link>
          </div>
          {upcoming.length > 0 ? (
            <div className="upcoming-list">
              {upcoming.map((bill) => {
                const due = clampDayToMonth(month, bill.due_day);
                const overdue = due < today && month <= currentMonth;
                return (
                  <Link to="/recorrentes" className="upcoming-row" key={bill.id}>
                    <span className="upcoming-row__day">{String(bill.due_day).padStart(2, '0')}</span>
                    <span className="upcoming-row__main">
                      <strong>{bill.name}</strong>
                      <small>{bill.category_name ?? 'Conta recorrente'}</small>
                    </span>
                    <span className="upcoming-row__amount">{formatBRL(bill.amount)}</span>
                    {overdue ? <Badge tone="wine">Vencido</Badge> : <Badge>Em aberto</Badge>}
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="Tudo em ordem"
              description="Nenhuma conta recorrente em aberto neste mês."
              action={
                <Link to="/recorrentes" className="text-link">
                  Criar recorrência <ArrowRight size={13} />
                </Link>
              }
            />
          )}
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--split">
        <article className="panel">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Limites</p>
              <h2 className="panel__title">Orçamentos</h2>
            </div>
            <Link to="/orcamentos" className="panel__link">
              Ajustar
            </Link>
          </div>
          {budgets.length > 0 ? (
            <>
              <div className="budget-overview">
                <span>
                  <strong>{formatBRL(budgetSpent)}</strong> de {formatBRL(budgetTotal)}
                </span>
                <span className={budgetOverspent ? 'is-wine' : 'is-gold'}>{budgetUsed}%</span>
              </div>
              <ProgressBar value={budgetUsed} tone={budgetOverspent ? 'wine' : 'gold'} />
              <div className="budget-mini-list">
                {topBudgets.map((budget) => {
                  const used = percent(budget.spent, budget.amount);
                  return (
                    <div className="budget-mini" key={budget.id}>
                      <div className="budget-mini__head">
                        <span>
                          <span className="dot" style={{ background: budget.category_color }} />
                          {budget.category_name}
                        </span>
                        <strong className={budget.spent > budget.amount ? 'is-wine' : ''}>
                          {formatBRL(budget.spent)}
                          <small> / {formatBRL(budget.amount)}</small>
                        </strong>
                      </div>
                      <ProgressBar value={used} tone={budget.spent > budget.amount ? 'wine' : 'gold'} />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState
              icon={PieChart}
              title="Sem limites definidos"
              description="Defina um teto por categoria para saber quando parar."
              action={
                <Link to="/orcamentos" className="text-link">
                  Criar orçamento <ArrowRight size={13} />
                </Link>
              }
            />
          )}
        </article>

        <article className="panel">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Objetivos</p>
              <h2 className="panel__title">Metas</h2>
            </div>
            <Link to="/metas" className="panel__link">
              Ver metas
            </Link>
          </div>
          {topGoals.length > 0 ? (
            <div className="goal-mini-list">
              {topGoals.map((goal) => {
                const progress = percent(goal.saved, goal.target);
                const done = goal.saved >= goal.target;
                return (
                  <div className="goal-mini" key={goal.id}>
                    <div className="budget-mini__head">
                      <span>
                        <Target size={13} strokeWidth={1.4} /> {goal.name}
                      </span>
                      <strong className={done ? 'is-gold' : ''}>{progress}%</strong>
                    </div>
                    <ProgressBar value={progress} tone={done ? 'gold' : 'muted'} />
                    <span className="goal-mini__values">
                      {formatBRL(goal.saved)} <small>de {formatBRL(goal.target)}</small>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Target}
              title="Nenhuma meta ainda"
              description="Reserva de emergência, viagem, quitação: escolha um objetivo."
              action={
                <Link to="/metas" className="text-link">
                  Criar meta <ArrowRight size={13} />
                </Link>
              }
            />
          )}
        </article>
      </section>

      <TransactionModal
        open={txOpen}
        onClose={() => {
          setTxOpen(false);
          setEditing(null);
        }}
        transaction={editing}
      />
    </div>
  );
}
