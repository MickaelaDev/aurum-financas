import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { listBudgets, listCategories, saveBudget } from '../lib/repo';
import type { BudgetView } from '../lib/types';
import { CurrencyInput, Field, Modal, Select, Button, useToast } from './ui';

export function BudgetModal({
  open,
  onClose,
  month,
  existing,
  presetCategoryId,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  existing?: BudgetView | null;
  presetCategoryId?: string;
}) {
  const { db, version, bump } = useApp();
  const { toast } = useToast();
  const categories = useMemo(() => listCategories(db), [db, version]);
  const budgets = useMemo(() => listBudgets(db, month), [db, version, month]);

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState('');

  const options = useMemo(() => {
    const used = new Set(
      budgets.filter((budget) => budget.id !== existing?.id).map((budget) => budget.category_id),
    );
    return categories.filter(
      (category) =>
        category.kind === 'expense' &&
        (category.id === existing?.category_id || !used.has(category.id)),
    );
  }, [categories, budgets, existing]);

  useEffect(() => {
    if (!open) return;
    setCategoryId(existing?.category_id ?? presetCategoryId ?? options[0]?.id ?? '');
    setAmount(existing?.amount ?? 0);
    setError('');
    // Inicializa apenas ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id, presetCategoryId]);

  function submit() {
    if (!categoryId) {
      setError('Escolha uma categoria.');
      return;
    }
    if (amount <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    saveBudget(db, month, categoryId, amount);
    bump();
    toast(existing ? 'Orçamento atualizado.' : 'Orçamento definido.');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Limite mensal"
      title={existing ? 'Ajustar orçamento' : 'Novo orçamento'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={options.length === 0}>
            Salvar
          </Button>
        </>
      }
    >
      {options.length === 0 ? (
        <div className="notice notice--muted">
          Todas as categorias de despesa já têm um orçamento neste mês.
        </div>
      ) : (
        <div className="form-grid">
          <Field label="Categoria" error={error} htmlFor="budget-category" className="span-2">
            <Select
              id="budget-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={Boolean(existing)}
            >
              {options.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Limite do mês" htmlFor="budget-amount" className="span-2">
            <CurrencyInput id="budget-amount" value={amount} onChange={setAmount} autoFocus />
          </Field>
        </div>
      )}
    </Modal>
  );
}
