import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { saveDeduction } from '../lib/repo';
import type { Deduction } from '../lib/types';
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

const KIND_LABEL: Record<Deduction['kind'], string> = {
  inss: 'INSS',
  crediario: 'Crediário',
  other: 'Outro desconto',
};

export function DeductionModal({
  open,
  onClose,
  deduction,
}: {
  open: boolean;
  onClose: () => void;
  deduction?: Deduction | null;
}) {
  const { db, bump } = useApp();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Deduction['kind']>('inss');
  const [amount, setAmount] = useState(0);
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName(deduction?.name ?? 'INSS');
    setKind(deduction?.kind ?? 'inss');
    setAmount(deduction?.amount ?? 0);
    setActive(deduction ? deduction.active === 1 : true);
  }, [open, deduction]);

  function changeKind(next: Deduction['kind']) {
    setKind(next);
    if (!name.trim() || Object.values(KIND_LABEL).includes(name.trim())) {
      setName(KIND_LABEL[next]);
    }
  }

  function submit() {
    if (!name.trim()) {
      setError('Dê um nome para o desconto.');
      return;
    }
    if (amount <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    saveDeduction(db, {
      id: deduction?.id,
      name,
      kind,
      amount,
      active: active ? 1 : 0,
    });
    bump();
    toast(deduction ? 'Desconto atualizado.' : 'Desconto adicionado.');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Desconto mensal"
      title={deduction ? 'Ajustar desconto' : 'Adicionar desconto'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>{deduction ? 'Salvar' : 'Adicionar'}</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nome" error={error} htmlFor="deduction-name" className="span-2">
          <Input
            id="deduction-name"
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 40))}
            autoFocus
          />
        </Field>
        <Field label="Tipo" htmlFor="deduction-kind">
          <Select
            id="deduction-kind"
            value={kind}
            onChange={(event) => changeKind(event.target.value as Deduction['kind'])}
          >
            <option value="inss">INSS</option>
            <option value="crediario">Crediário</option>
            <option value="other">Outro</option>
          </Select>
        </Field>
        <Field label="Valor mensal" htmlFor="deduction-amount">
          <CurrencyInput id="deduction-amount" value={amount} onChange={setAmount} />
        </Field>
        <div className="form-switch span-2">
          <div>
            <span className="form-switch__label">Desconto ativo</span>
            <p>Entra no cálculo do salário líquido.</p>
          </div>
          <Switch checked={active} onChange={() => setActive((current) => !current)} label="Ativar desconto" />
        </div>
      </div>
    </Modal>
  );
}
