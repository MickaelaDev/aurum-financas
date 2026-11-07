import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { addGoalContribution, saveGoal } from '../lib/repo';
import type { Goal } from '../lib/types';
import {
  Button,
  CurrencyInput,
  Field,
  Input,
  Modal,
  ProgressBar,
  useToast,
} from './ui';
import { formatBRL, percent } from '../lib/money';

export function GoalModal({
  open,
  onClose,
  goal,
}: {
  open: boolean;
  onClose: () => void;
  goal?: Goal | null;
}) {
  const { db, bump } = useApp();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [target, setTarget] = useState(0);
  const [saved, setSaved] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName(goal?.name ?? '');
    setTarget(goal?.target ?? 0);
    setSaved(goal?.saved ?? 0);
    setDeadline(goal?.deadline ?? '');
  }, [open, goal]);

  function submit() {
    if (!name.trim()) {
      setError('Dê um nome para a meta.');
      return;
    }
    if (target <= 0) {
      setError('Informe um valor-alvo maior que zero.');
      return;
    }
    saveGoal(db, { id: goal?.id, name, target, saved, deadline: deadline || null });
    bump();
    toast(goal ? 'Meta atualizada.' : 'Meta criada.');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Objetivo"
      title={goal ? 'Ajustar meta' : 'Nova meta'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>{goal ? 'Salvar' : 'Criar meta'}</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nome" error={error} htmlFor="goal-name" className="span-2">
          <Input
            id="goal-name"
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 50))}
            placeholder="Ex.: Reserva de emergência"
            autoFocus
          />
        </Field>
        <Field label="Valor-alvo" htmlFor="goal-target">
          <CurrencyInput id="goal-target" value={target} onChange={setTarget} />
        </Field>
        <Field label="Já economizado" htmlFor="goal-saved">
          <CurrencyInput id="goal-saved" value={saved} onChange={setSaved} />
        </Field>
        <Field label="Prazo" hint="opcional" htmlFor="goal-deadline" className="span-2">
          <Input
            id="goal-deadline"
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

export function ContributionModal({
  open,
  onClose,
  goal,
}: {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
}) {
  const { db, bump } = useApp();
  const { toast } = useToast();
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setAmount(0);
    setError('');
  }, [open]);

  function submit() {
    if (!goal) return;
    if (amount <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    addGoalContribution(db, goal, amount);
    bump();
    toast('Aporte registrado.');
    onClose();
  }

  const projected = goal ? goal.saved + amount : 0;
  const projectedPercent = goal ? percent(projected, goal.target) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={goal?.name}
      title="Adicionar aporte"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!goal}>
            Aportar
          </Button>
        </>
      }
    >
      <div className="contribution">
        <Field label="Valor do aporte" error={error} htmlFor="goal-contribution">
          <CurrencyInput
            id="goal-contribution"
            value={amount}
            onChange={setAmount}
            autoFocus
          />
        </Field>
        {goal ? (
          <div className="contribution__preview">
            <div className="contribution__numbers">
              <span>
                {formatBRL(goal.saved)} <small>guardados</small>
              </span>
              <strong>
                {formatBRL(projected)} <small>de {formatBRL(goal.target)}</small>
              </strong>
            </div>
            <ProgressBar value={projectedPercent} />
            <span className="contribution__percent">{projectedPercent}% da meta</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
