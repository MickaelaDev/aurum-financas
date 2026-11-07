import { useMemo, useState } from 'react';
import { Copy, Pencil, PieChart, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { currentMonthKey, monthLabel, shiftMonth } from '../lib/date';
import { formatBRL, percent } from '../lib/money';
import {
  copyBudgets,
  listBudgets,
  listCategories,
  saveBudget,
} from '../lib/repo';
import type { BudgetView } from '../lib/types';
import {
  Button,
  ConfirmDialog,
  Dot,
  EmptyState,
  IconButton,
  MonthSwitcher,
  PageHeader,
  ProgressBar,
  useToast,
} from '../components/ui';
import { BudgetModal } from '../components/BudgetModal';

export function Budgets() {
  const { db, version, bump } = useApp();
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetView | null>(null);
  const [presetCategoryId, setPresetCategoryId] = useState<string | undefined>(undefined);
  const [deleting, setDeleting] = useState<BudgetView | null>(null);

  const budgets = useMemo(() => listBudgets(db, month), [db, version, month]);
  const categories = useMemo(
    () => listCategories(db).filter((category) => category.kind === 'expense'),
    [db, version],
  );

  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const remaining = totalBudget - totalSpent;
  const used = percent(totalSpent, totalBudget);
  const unbudgeted = categories.filter(
    (category) => !budgets.some((budget) => budget.category_id === category.id),
  );

  function openNew(categoryId?: string) {
    setEditing(null);
    setPresetCategoryId(categoryId);
    setModalOpen(true);
  }

  function openEdit(budget: BudgetView) {
    setEditing(budget);
    setPresetCategoryId(undefined);
    setModalOpen(true);
  }

  function copyPrevious() {
    const count = copyBudgets(db, shiftMonth(month, -1), month);
    if (count === 0) {
      toast('Nenhum orçamento novo para copiar do mês anterior.', 'info');
      return;
    }
    bump();
    toast(`${count} ${count === 1 ? 'orçamento copiado' : 'orçamentos copiados'}.`);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Planejamento"
        title="Orçamentos"
        description="Um teto por categoria para o mês — e a consciência de quando parar."
        actions={
          <>
            <MonthSwitcher value={month} onChange={setMonth} />
            <Button variant="secondary" icon={<Copy size={14} />} onClick={copyPrevious}>
              Copiar anterior
            </Button>
            <Button icon={<Plus size={15} />} onClick={() => openNew()}>
              Novo orçamento
            </Button>
          </>
        }
      />

      <section className="panel budget-summary">
        <div className="budget-summary__grid">
          <div>
            <span>Orçado em {monthLabel(month)}</span>
            <strong>{formatBRL(totalBudget)}</strong>
          </div>
          <div>
            <span>Gasto até agora</span>
            <strong className="is-wine">{formatBRL(totalSpent)}</strong>
          </div>
          <div>
            <span>Restante</span>
            <strong className={remaining < 0 ? 'is-wine' : 'is-gold'}>
              {formatBRL(remaining)}
            </strong>
          </div>
          <div>
            <span>Uso geral</span>
            <strong>{used}%</strong>
          </div>
        </div>
        <ProgressBar value={used} tone={remaining < 0 ? 'wine' : 'gold'} />
      </section>

      {budgets.length > 0 ? (
        <section className="panel panel--flush">
          <div className="budget-list">
            <div className="budget-list__head">
              <span>Categoria</span>
              <span>Consumo</span>
              <span>Limite</span>
              <span>Restante</span>
              <span />
            </div>
            {budgets.map((budget) => {
              const budgetRemaining = budget.amount - budget.spent;
              const budgetUsed = percent(budget.spent, budget.amount);
              return (
                <div className="budget-row" key={budget.id}>
                  <span className="budget-row__category">
                    <Dot color={budget.category_color} />
                    <span>
                      <strong>{budget.category_name}</strong>
                      <small>{budgetUsed}% usado</small>
                    </span>
                  </span>
                  <span className="budget-row__consumption">
                    <span className="budget-row__numbers">
                      <strong>{formatBRL(budget.spent)}</strong>
                      <small>de {formatBRL(budget.amount)}</small>
                    </span>
                    <ProgressBar
                      value={budgetUsed}
                      tone={budgetRemaining < 0 ? 'wine' : 'gold'}
                    />
                  </span>
                  <span className="budget-row__value">
                    <span>Limite</span>
                    <strong>{formatBRL(budget.amount)}</strong>
                  </span>
                  <span className="budget-row__value">
                    <span>Restante</span>
                    <strong className={budgetRemaining < 0 ? 'is-wine' : ''}>
                      {formatBRL(budgetRemaining)}
                    </strong>
                  </span>
                  <span className="budget-row__actions">
                    <IconButton
                      label="Editar orçamento"
                      icon={<Pencil size={15} />}
                      onClick={() => openEdit(budget)}
                    />
                    <IconButton
                      label="Remover orçamento"
                      tone="danger"
                      icon={<Trash2 size={15} />}
                      onClick={() => setDeleting(budget)}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="panel">
          <EmptyState
            icon={PieChart}
            title="Nenhum limite neste mês"
            description="Defina quanto pretende gastar por categoria. Você pode copiar os limites do mês anterior."
            action={
              <div className="empty__actions">
                <Button size="sm" onClick={() => openNew()}>
                  Criar orçamento
                </Button>
                <Button size="sm" variant="secondary" onClick={copyPrevious}>
                  Copiar mês anterior
                </Button>
              </div>
            }
          />
        </section>
      )}

      {unbudgeted.length > 0 ? (
        <section className="panel">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Ainda sem limite</p>
              <h2 className="panel__title">Categorias livres</h2>
            </div>
          </div>
          <div className="chip-list">
            {unbudgeted.map((category) => (
              <button
                key={category.id}
                type="button"
                className="chip"
                onClick={() => openNew(category.id)}
              >
                <Plus size={12} />
                <Dot color={category.color} />
                {category.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <BudgetModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setPresetCategoryId(undefined);
        }}
        month={month}
        existing={editing}
        presetCategoryId={presetCategoryId}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remover orçamento"
        description="O limite desta categoria será removido deste mês. As transações continuam intactas."
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          saveBudget(db, month, deleting.category_id, 0);
          bump();
          toast('Orçamento removido.', 'info');
          setDeleting(null);
        }}
      />
    </div>
  );
}
