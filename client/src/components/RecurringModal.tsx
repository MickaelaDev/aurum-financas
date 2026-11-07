import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { currentMonthKey } from '../lib/date';
import { listAccounts, listCategories, saveRecurring } from '../lib/repo';
import type { RecurringBill } from '../lib/types';
import {
  Button,
  CurrencyInput,
  Field,
  Input,
  Modal,
  Select,
  Switch,
  useToast,
} from './ui';

export function RecurringModal({
  open,
  onClose,
  bill,
}: {
  open: boolean;
  onClose: () => void;
  bill?: RecurringBill | null;
}) {
  const { db, version, bump } = useApp();
  const { toast } = useToast();
  const accounts = useMemo(() => listAccounts(db), [db, version]);
  const categories = useMemo(
    () => listCategories(db).filter((category) => category.kind === 'expense'),
    [db, version],
  );

  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dueDay, setDueDay] = useState(5);
  const [startMonth, setStartMonth] = useState(currentMonthKey());
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName(bill?.name ?? '');
    setAmount(bill?.amount ?? 0);
    setCategoryId(bill?.category_id ?? categories[0]?.id ?? '');
    setAccountId(bill?.account_id ?? accounts[0]?.id ?? '');
    setDueDay(bill?.due_day ?? 5);
    setStartMonth(bill?.start_month ?? currentMonthKey());
    setActive(bill ? bill.active === 1 : true);
    // Inicializa apenas ao abrir (ou ao trocar de registro).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bill?.id]);

  function submit() {
    if (!name.trim()) {
      setError('Dê um nome para a conta.');
      return;
    }
    if (amount <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (!accountId) {
      setError('Escolha a conta de saída.');
      return;
    }
    saveRecurring(db, {
      id: bill?.id,
      name,
      amount,
      category_id: categoryId || null,
      account_id: accountId || null,
      due_day: dueDay,
      start_month: startMonth,
      active: active ? 1 : 0,
    });
    bump();
    toast(bill ? 'Conta recorrente atualizada.' : 'Conta recorrente criada.');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Conta fixa"
      title={bill ? 'Ajustar recorrência' : 'Nova recorrência'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>{bill ? 'Salvar' : 'Criar'}</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nome" error={error} htmlFor="recurring-name" className="span-2">
          <Input
            id="recurring-name"
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 50))}
            placeholder="Ex.: Aluguel, internet, streaming"
            autoFocus
          />
        </Field>
        <Field label="Valor mensal" htmlFor="recurring-amount">
          <CurrencyInput id="recurring-amount" value={amount} onChange={setAmount} />
        </Field>
        <Field label="Dia do vencimento" htmlFor="recurring-day">
          <Input
            id="recurring-day"
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(event) => setDueDay(Number(event.target.value))}
          />
        </Field>
        <Field label="Categoria" htmlFor="recurring-category">
          <Select
            id="recurring-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Conta de saída" htmlFor="recurring-account">
          <Select
            id="recurring-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">Selecione</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Início" hint="mês de referência" htmlFor="recurring-start" className="span-2">
          <Input
            id="recurring-start"
            type="month"
            value={startMonth}
            onChange={(event) => setStartMonth(event.target.value)}
          />
        </Field>
        <div className="form-switch span-2">
          <div>
            <span className="form-switch__label">Ativa</span>
            <p>Aparece nos vencimentos e no total mensal.</p>
          </div>
          <Switch checked={active} onChange={() => setActive((current) => !current)} label="Ativar recorrência" />
        </div>
      </div>
    </Modal>
  );
}
