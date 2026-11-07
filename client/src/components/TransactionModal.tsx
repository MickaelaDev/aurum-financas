import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { todayISO } from '../lib/date';
import { deleteTransaction, listAccounts, listCategories, saveTransaction } from '../lib/repo';
import type { Transaction, TransactionType } from '../lib/types';
import {
  Button,
  ConfirmDialog,
  CurrencyInput,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from './ui';

type Errors = Partial<Record<'amount' | 'description' | 'account' | 'date', string>>;

export function TransactionModal({
  open,
  onClose,
  transaction,
  initialType = 'expense',
}: {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  initialType?: TransactionType;
}) {
  const { db, version, bump } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();

  const accounts = useMemo(() => listAccounts(db, true), [db, version]);
  const categories = useMemo(() => listCategories(db, true), [db, version]);

  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setConfirmDelete(false);
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount);
      setDate(transaction.date);
      setDescription(transaction.description);
      setAccountId(transaction.account_id);
      setCategoryId(transaction.category_id ?? '');
      setNotes(transaction.notes ?? '');
      return;
    }
    const firstAccount = accounts.find((account) => account.archived === 0) ?? accounts[0];
    setType(initialType);
    setAmount(0);
    setDate(todayISO());
    setDescription('');
    setAccountId(firstAccount?.id ?? '');
    setNotes('');
    const firstCategory = categories.find(
      (category) => category.kind === initialType && category.archived === 0,
    );
    setCategoryId(firstCategory?.id ?? '');
    // Inicializa apenas ao abrir; a sincronização não deve apagar o formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id, initialType]);

  const availableAccounts = accounts;
  const availableCategories = categories.filter(
    (category) =>
      category.kind === type &&
      (category.archived === 0 || category.id === transaction?.category_id),
  );

  function changeType(next: TransactionType) {
    setType(next);
    const first = categories.find(
      (category) => category.kind === next && category.archived === 0,
    );
    setCategoryId(first?.id ?? '');
  }

  function submit() {
    const nextErrors: Errors = {};
    if (amount <= 0) nextErrors.amount = 'Informe um valor maior que zero.';
    if (!description.trim()) nextErrors.description = 'Descreva a movimentação.';
    if (!accountId) nextErrors.account = 'Escolha uma conta.';
    if (!date) nextErrors.date = 'Informe a data.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    saveTransaction(db, {
      id: transaction?.id,
      account_id: accountId,
      category_id: categoryId || null,
      type,
      amount,
      date,
      description,
      notes,
    });
    bump();
    toast(transaction ? 'Transação atualizada.' : 'Transação registrada.');
    onClose();
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        eyebrow={transaction ? 'Editar lançamento' : 'Novo lançamento'}
        title={transaction ? 'Ajustar transação' : 'Registrar transação'}
        footer={
          <>
            {transaction ? (
              <Button
                variant="ghost"
                icon={<Trash2 size={14} />}
                onClick={() => setConfirmDelete(true)}
              >
                Excluir
              </Button>
            ) : null}
            <span className="spacer" />
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit}>{transaction ? 'Salvar' : 'Registrar'}</Button>
          </>
        }
      >
        {availableAccounts.length === 0 ? (
          <div className="notice notice--muted">
            <span>Crie uma conta antes de registrar movimentações.</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/contas');
              }}
            >
              Ir para contas
            </button>
          </div>
        ) : null}

        <div className="segmented" role="group" aria-label="Tipo de transação">
          <button
            type="button"
            className={type === 'expense' ? 'is-active' : ''}
            onClick={() => changeType('expense')}
          >
            <ArrowUpRight size={14} /> Saída
          </button>
          <button
            type="button"
            className={type === 'income' ? 'is-active' : ''}
            onClick={() => changeType('income')}
          >
            <ArrowDownLeft size={14} /> Entrada
          </button>
        </div>

        <div className="form-grid">
          <Field label="Valor" error={errors.amount} htmlFor="tx-amount">
            <CurrencyInput id="tx-amount" value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Data" error={errors.date} htmlFor="tx-date">
            <Input
              id="tx-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Descrição" error={errors.description} htmlFor="tx-description" className="span-2">
            <Input
              id="tx-description"
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 80))}
              placeholder="Ex.: mercado, aluguel, projeto"
            />
          </Field>
          <Field label="Categoria" htmlFor="tx-category">
            <Select
              id="tx-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Sem categoria</option>
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Conta" error={errors.account} htmlFor="tx-account">
            <Select
              id="tx-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Selecione</option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                  {account.archived ? ' (arquivada)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Observações" htmlFor="tx-notes" className="span-2">
            <Textarea
              id="tx-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value.slice(0, 240))}
              placeholder="Opcional"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir transação"
        description="Esta movimentação deixará de contar nos saldos e relatórios."
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!transaction) return;
          deleteTransaction(db, transaction.id);
          bump();
          toast('Transação excluída.', 'info');
          onClose();
        }}
      />
    </>
  );
}
