import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { formatDateFull, todayISO } from '../lib/date';
import { formatBRL, percent } from '../lib/money';
import { deleteGoal, listGoals } from '../lib/repo';
import type { Goal } from '../lib/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  PageHeader,
  ProgressBar,
  useToast,
} from '../components/ui';
import { ContributionModal, GoalModal } from '../components/GoalModal';

export function Goals() {
  const { db, version, bump } = useApp();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);

  const goals = useMemo(() => listGoals(db), [db, version]);
  const totalSaved = goals.reduce((sum, goal) => sum + goal.saved, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0);
  const completed = goals.filter((goal) => goal.saved >= goal.target).length;
  const today = todayISO();

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setModalOpen(true);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Objetivos"
        title="Metas"
        description="Cada aporte aproxima você do que importa. Sem pressa, sem improviso."
        actions={
          <Button icon={<Plus size={15} />} onClick={openNew}>
            Nova meta
          </Button>
        }
      />

      <section className="panel goal-summary">
        <div>
          <span>Guardado no total</span>
          <strong className="is-gold">{formatBRL(totalSaved)}</strong>
        </div>
        <div>
          <span>Soma das metas</span>
          <strong>{formatBRL(totalTarget)}</strong>
        </div>
        <div>
          <span>Metas concluídas</span>
          <strong>
            {completed} <small>de {goals.length}</small>
          </strong>
        </div>
      </section>

      {goals.length > 0 ? (
        <section className="goal-grid">
          {goals.map((goal) => {
            const progress = percent(goal.saved, goal.target);
            const done = goal.saved >= goal.target;
            const overdue = Boolean(goal.deadline && goal.deadline < today && !done);
            const remaining = Math.max(0, goal.target - goal.saved);

            return (
              <article className={`panel goal-card ${done ? 'is-done' : ''}`.trim()} key={goal.id}>
                <div className="goal-card__head">
                  <div>
                    <p className="eyebrow">
                      {goal.deadline ? (
                        <span className={overdue ? 'is-wine' : ''}>
                          {overdue ? 'Prazo vencido · ' : 'Prazo · '}
                          {formatDateFull(goal.deadline)}
                        </span>
                      ) : (
                        'Sem prazo definido'
                      )}
                    </p>
                    <h2>{goal.name}</h2>
                  </div>
                  {done ? (
                    <Badge tone="olive">
                      <Check size={11} /> Concluída
                    </Badge>
                  ) : (
                    <IconButton
                      label="Editar meta"
                      icon={<Pencil size={15} />}
                      onClick={() => openEdit(goal)}
                    />
                  )}
                </div>

                <p className="goal-card__value">
                  {formatBRL(goal.saved)}
                  <small> de {formatBRL(goal.target)}</small>
                </p>
                <ProgressBar value={progress} tone={done ? 'gold' : 'muted'} />
                <div className="goal-card__meta">
                  <span>{progress}%</span>
                  <span>{done ? 'Meta alcançada' : `Faltam ${formatBRL(remaining)}`}</span>
                </div>

                <div className="goal-card__foot">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus size={13} />}
                    onClick={() => setContributing(goal)}
                    disabled={done}
                  >
                    Aportar
                  </Button>
                  <IconButton
                    label="Excluir meta"
                    tone="danger"
                    icon={<Trash2 size={15} />}
                    onClick={() => setDeleting(goal)}
                  />
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel">
          <EmptyState
            icon={Target}
            title="Nenhuma meta ainda"
            description="Comece por uma reserva de emergência ou por aquilo que você quer conquistar."
            action={
              <Button size="sm" onClick={openNew}>
                Criar primeira meta
              </Button>
            }
          />
        </section>
      )}

      <GoalModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        goal={editing}
      />

      <ContributionModal
        open={Boolean(contributing)}
        onClose={() => setContributing(null)}
        goal={contributing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir meta"
        description="A meta e o progresso guardado serão removidos. Isso não altera o saldo das contas."
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteGoal(db, deleting.id);
          bump();
          toast('Meta excluída.', 'info');
          setDeleting(null);
        }}
      />
    </div>
  );
}
