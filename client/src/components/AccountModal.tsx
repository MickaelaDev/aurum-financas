import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { saveAccount } from '../lib/repo';
import type { Account } from '../lib/types';
import {
  Button,
  ColorPicker,
  CurrencyInput,
  Field,
  Input,
  Modal,
  Select,
  useToast,
} from './ui';

const TYPES: Array<{ value: Account['type']; label: string }> = [
  { value: 'checking', label: 'Conta corrente' },
  { value: 'savings', label: 'Poupança' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'investment', label: 'Investimento' },
  { value: 'other', label: 'Outra' },
];

export function AccountModal({
  open,
  onClose,
  account,
}: {
  open: boolean;
  onClose: () => void;
  account?: Account | null;
}) {
  const { db, bump } = useApp();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('checking');
  const [initialBalance, setInitialBalance] = useState(0);
  const [color, setColor] = useState('#c9a86a');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName(account?.name ?? '');
    setType(account?.type ?? 'checking');
    setInitialBalance(account?.initial_balance ?? 0);
    setColor(account?.color ?? '#c9a86a');
  }, [open, account?.id, account]);

  function submit() {
    if (!name.trim()) {
      setError('Dê um nome para a conta.');
      return;
    }
    saveAccount(db, {
      id: account?.id,
      name,
      type,
      initial_balance: initialBalance,
      color,
      archived: account?.archived,
    });
    bump();
    toast(account ? 'Conta atualizada.' : 'Conta criada.');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={account ? 'Editar conta' : 'Nova conta'}
      title={account ? 'Ajustar conta' : 'Adicionar conta'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>{account ? 'Salvar' : 'Criar conta'}</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nome" error={error} htmlFor="account-name" className="span-2">
          <Input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 40))}
            placeholder="Ex.: Banco do Brasil"
            autoFocus
          />
        </Field>
        <Field label="Tipo" htmlFor="account-type">
          <Select
            id="account-type"
            value={type}
            onChange={(event) => setType(event.target.value as Account['type'])}
          >
            {TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Saldo inicial" htmlFor="account-initial">
          <CurrencyInput id="account-initial" value={initialBalance} onChange={setInitialBalance} />
        </Field>
        <Field label="Cor de identificação" className="span-2">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </div>
    </Modal>
  );
}
