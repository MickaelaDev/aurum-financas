import { useMemo, useState } from 'react';
import { CalendarClock, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import {
  clampDayToMonth,
  currentMonthKey,
  monthLabel,
  todayISO,
} from '../lib/date';
import { formatBRL, percent } from '../lib/money';
import {
  deleteRecurring,
  listRecurring,
  payRecurring,
  setRecurringActive,
} from '../lib/repo';
import type { RecurringBill } from '../lib/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  Dot,
  EmptyState,
  IconButton,
  MonthSwitcher,
  PageHeader,
  ProgressBar,
  Switch,
  useToast,
} from '../components/ui';
import { RecurringModal } from '../components/RecurringModal';

export function Recurring() {
  const { db, version, bump } = useApp();
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringBill | null>(null);
  const [deleting, setDeleting] = useState<RecurringBill | null>(null);

  const all = useMemo(() => listRecurring(db, month), [db, version, month]);
  const bills = all.filter((bill) => bill.start_month <= month);
  const active = bills.filter((bill) => bill.active === 1);
  const total = active.reduce((sum, bill) => sum + bill.amount, 0);
  const paid = active
    .filter((bill) => bill.paid_transaction_id)
    .reduce((sum, bill) => sum + bill.amount, 0);
  const open = total - paid;
  const paidPercent = percent(paid, total);
  const current = currentMonthKey();
  const today = todayISO();

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(bill: RecurringBill) {
    setEditing(bill);
    setModalOpen(true);
  }

  function toggle(bill: RecurringBill) {
    setRecurringActive(db, bill, bill.active === 0);
    bump();
    toast(bill.active === 1 ? 'Recorrência desativada.' : 'Recorrência ativada.', 'info');
  }

  function pay(bill: RecurringBill) {
    const result = payRecurring(db, bill, month);
    bump();
    toast(
      result.created ? 'Conta marcada como paga.' : 'Esta conta já estava paga neste mês.',
      result.created ? 'success' : 'info',
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Agenda fixa"
        title="Recorrentes"
        description="Aluguel, internet, assinaturas e tudo que volta todo mês — sem surpresa."
        actions={
          <>
            <MonthSwitcher value={month} onChange={setMonth} />
            <Button icon={<Plus size={15} />} onClick={openNew}>
              Nova recorrência
            </Button>
          </>
        }
      />

      <section className="panel rec-summary">
        <div className="rec-summary__grid">
          <div>
            <span>Total mensal ativo</span>
            <strong>{formatBRL(total)}</strong>
          </div>
          <div>
            <span>Pago em {monthLabel(month)}</span>
            <strong className="is-gold">{formatBRL(paid)}</strong>
          </div>
          <div>
            <span>Em aberto</span>
            <strong className={open > 0 ? 'is-wine' : ''}>{formatBRL(open)}</strong>
          </div>
          <div>
            <span>Quitado</span>
            <strong>{paidPercent}%</strong>
          </div>
        </div>
        <ProgressBar value={paidPercent} />
      </section>

      {bills.length > 0 ? (
        <section className="panel panel--flush">
          <div className="rec-list">
            <div className="rec-head">
              <span>Dia</span>
              <span>Conta</span>
              <span>Categoria</span>
              <span className="is-right">Valor</span>
              <span>Status</span>
              <span />
            </div>
            {bills.map((bill) => {
              const due = clampDayToMonth(month, bill.due_day);
              const overdue = bill.active === 1 && !bill.paid_transaction_id && due < today && month <= current;
              const status = bill.active === 0
                ? { label: 'Inativa', tone: 'neutral' as const }
                : bill.paid_transaction_id
                  ? { label: 'Pago', tone: 'olive' as const }
                  : overdue
                    ? { label: 'Vencido', tone: 'wine' as const }
                    : { label: 'Em aberto', tone: 'neutral' as const };

              return (
                <div
                  className={`rec-row ${bill.active === 0 ? 'is-inactive' : ''}`.trim()}
                  key={bill.id}
                >
                  <span className="rec-row__day">{String(bill.due_day).padStart(2, '0')}</span>
                  <span className="rec-row__main">
                    <strong>{bill.name}</strong>
                    <small>{bill.account_name ?? 'Sem conta'}</small>
                  </span>
                  <span className="rec-row__category">
                    {bill.category_name ? (
                      <>
                        <Dot color={bill.category_color ?? '#6b655c'} />
                        {bill.category_name}
                      </>
                    ) : (
                      <span className="is-muted">Sem categoria</span>
                    )}
                  </span>
                  <span className="rec-row__amount">{formatBRL(bill.amount)}</span>
                  <span className="rec-row__status">
                    <Badge tone={status.tone}>
                      {status.tone === 'olive' ? <Check size={11} /> : null}
                      {status.label}
                    </Badge>
                  </span>
                  <span className="rec-row__actions">
                    {bill.active === 1 && !bill.paid_transaction_id ? (
                      <Button size="sm" variant="secondary" onClick={() => pay(bill)}>
                        Pagar
                      </Button>
                    ) : null}
                    <Switch
                      checked={bill.active === 1}
                      onChange={() => toggle(bill)}
                      label={bill.active === 1 ? 'Desativar recorrência' : 'Ativar recorrência'}
                    />
                    <IconButton
                      label="Editar recorrência"
                      icon={<Pencil size={15} />}
                      onClick={() => openEdit(bill)}
                    />
                    <IconButton
                      label="Excluir recorrência"
                      tone="danger"
                      icon={<Trash2 size={15} />}
                      onClick={() => setDeleting(bill)}
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
            icon={CalendarClock}
            title="Nenhuma conta recorrente"
            description="Adicione as contas que se repetem todo mês para nunca perder um vencimento."
            action={
              <Button size="sm" onClick={openNew}>
                Criar recorrência
              </Button>
            }
          />
        </section>
      )}

      <RecurringModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        bill={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir recorrência"
        description="A conta deixa de aparecer na agenda. As transações já pagas continuam intactas."
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteRecurring(db, deleting.id);
          bump();
          toast('Recorrência excluída.', 'info');
          setDeleting(null);
        }}
      />
    </div>
  );
}
