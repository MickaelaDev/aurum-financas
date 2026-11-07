import { useEffect, useMemo, useState } from 'react';
import { Check, Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import {
  currentMonthKey,
  formatDateFull,
  formatDateShort,
  monthLabel,
} from '../lib/date';
import { formatBRL } from '../lib/money';
import {
  deleteDeduction,
  findCategoryByName,
  getSalaryProfile,
  getSalaryTransaction,
  listAccounts,
  listDeductions,
  listSalaryHistory,
  registerSalary,
  salarySummary,
  saveSalaryProfile,
  setDeductionActive,
} from '../lib/repo';
import type { Deduction } from '../lib/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  CurrencyInput,
  EmptyState,
  Field,
  IconButton,
  Input,
  MonthSwitcher,
  PageHeader,
  Select,
  Switch,
  useToast,
} from '../components/ui';
import { DeductionModal } from '../components/DeductionModal';

const KIND_LABEL: Record<Deduction['kind'], string> = {
  inss: 'INSS',
  crediario: 'Crediário',
  other: 'Outro',
};

export function Salary() {
  const { db, version, bump } = useApp();
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [gross, setGross] = useState(0);
  const [paymentDay, setPaymentDay] = useState(5);
  const [accountId, setAccountId] = useState('');
  const [deductionOpen, setDeductionOpen] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState<Deduction | null>(null);
  const [deletingDeduction, setDeletingDeduction] = useState<Deduction | null>(null);

  const profile = useMemo(() => getSalaryProfile(db), [db, version]);
  const deductions = useMemo(() => listDeductions(db), [db, version]);
  const summary = useMemo(() => salarySummary(profile, deductions), [profile, deductions]);
  const accounts = useMemo(() => listAccounts(db), [db, version]);
  const salaryTx = useMemo(() => getSalaryTransaction(db, month), [db, version, month]);
  const history = useMemo(() => listSalaryHistory(db), [db, version]);

  useEffect(() => {
    setGross(profile?.gross ?? 0);
    setPaymentDay(profile?.payment_day ?? 5);
  }, [profile?.gross, profile?.payment_day]);

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const dirty =
    gross !== (profile?.gross ?? 0) || paymentDay !== (profile?.payment_day ?? 5);

  function saveProfile() {
    saveSalaryProfile(db, { gross, payment_day: paymentDay });
    bump();
    toast('Salário atualizado.');
  }

  function openNewDeduction() {
    setEditingDeduction(null);
    setDeductionOpen(true);
  }

  function toggleDeduction(deduction: Deduction) {
    setDeductionActive(db, deduction, deduction.active === 0);
    bump();
    toast(deduction.active === 1 ? 'Desconto desativado.' : 'Desconto ativado.', 'info');
  }

  function receive() {
    if (!profile || summary.gross <= 0) {
      toast('Configure o salário bruto antes de registrar o recebimento.', 'error');
      return;
    }
    if (!accountId) {
      toast('Escolha a conta de recebimento.', 'error');
      return;
    }
    registerSalary(db, {
      month,
      net: summary.net,
      gross: summary.gross,
      deductionsTotal: summary.deductionsTotal,
      paymentDay: profile.payment_day,
      accountId,
      categoryId: findCategoryByName(db, 'Salário')?.id ?? null,
    });
    bump();
    toast(salaryTx ? 'Recebimento do mês atualizado.' : 'Recebimento registrado.');
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Renda"
        title="Salário"
        description="Do bruto ao líquido, com INSS e crediário descontados — e o mês fechando sem dúvida."
        actions={<MonthSwitcher value={month} onChange={setMonth} />}
      />

      <div className="salary-layout">
        <div className="salary-column">
          <section className="panel">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Remuneração</p>
                <h2 className="panel__title">Salário bruto</h2>
                <p className="panel__sub">O valor antes dos descontos mensais.</p>
              </div>
              <span className="panel__icon">
                <Landmark size={17} strokeWidth={1.3} />
              </span>
            </div>

            <div className="form-grid">
              <Field label="Valor bruto" htmlFor="salary-gross">
                <CurrencyInput id="salary-gross" value={gross} onChange={setGross} />
              </Field>
              <Field label="Dia do pagamento" htmlFor="salary-day">
                <Input
                  id="salary-day"
                  type="number"
                  min={1}
                  max={31}
                  value={paymentDay}
                  onChange={(event) => setPaymentDay(Number(event.target.value))}
                />
              </Field>
            </div>
            <div className="form-actions">
              <Button variant="secondary" size="sm" onClick={saveProfile} disabled={!dirty}>
                Salvar alterações
              </Button>
            </div>
            <p className="panel__sub salary-hint">
              O INSS e o crediário são lançados manualmente. Você define o valor exato de cada
              desconto na lista abaixo.
            </p>
          </section>

          <section className="panel">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Descontos</p>
                <h2 className="panel__title">Do bruto ao líquido</h2>
                <p className="panel__sub">INSS, crediário e outros descontos fixos.</p>
              </div>
              <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={openNewDeduction}>
                Adicionar
              </Button>
            </div>

            {deductions.length > 0 ? (
              <div className="deduction-list">
                {deductions.map((deduction) => (
                  <div
                    className={`deduction-row ${deduction.active === 0 ? 'is-inactive' : ''}`.trim()}
                    key={deduction.id}
                  >
                    <span className="deduction-row__main">
                      <strong>{deduction.name}</strong>
                      <Badge
                        tone={
                          deduction.kind === 'inss'
                            ? 'gold'
                            : deduction.kind === 'crediario'
                              ? 'wine'
                              : 'neutral'
                        }
                      >
                        {KIND_LABEL[deduction.kind]}
                      </Badge>
                    </span>
                    <span className="deduction-row__amount">{formatBRL(deduction.amount)}</span>
                    <Switch
                      checked={deduction.active === 1}
                      onChange={() => toggleDeduction(deduction)}
                      label={deduction.active === 1 ? 'Desativar desconto' : 'Ativar desconto'}
                    />
                    <IconButton
                      label="Editar desconto"
                      icon={<Pencil size={15} />}
                      onClick={() => {
                        setEditingDeduction(deduction);
                        setDeductionOpen(true);
                      }}
                    />
                    <IconButton
                      label="Excluir desconto"
                      tone="danger"
                      icon={<Trash2 size={15} />}
                      onClick={() => setDeletingDeduction(deduction)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Landmark}
                title="Nenhum desconto lançado"
                description="Adicione o INSS e o crediário para chegar ao valor líquido."
                action={
                  <Button size="sm" onClick={openNewDeduction}>
                    Adicionar desconto
                  </Button>
                }
              />
            )}
          </section>
        </div>

        <aside className="salary-column salary-column--summary">
          <section className="panel panel--gold salary-summary">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Cálculo do mês</p>
                <h2 className="panel__title">{monthLabel(month)}</h2>
              </div>
              {salaryTx ? (
                <Badge tone="olive">
                  <Check size={11} /> Recebido
                </Badge>
              ) : (
                <Badge tone="gold">A receber</Badge>
              )}
            </div>

            <p className="salary-summary__label">Você recebe</p>
            <p className={`salary-summary__net ${summary.net < 0 ? 'is-wine' : ''}`}>
              {summary.gross > 0 ? formatBRL(summary.net) : '—'}
            </p>

            <div className="summary-rows">
              <div>
                <span>Salário bruto</span>
                <strong>{formatBRL(summary.gross)}</strong>
              </div>
              <div>
                <span>INSS</span>
                <strong className="is-wine">− {formatBRL(summary.inss)}</strong>
              </div>
              <div>
                <span>Crediário</span>
                <strong className="is-wine">− {formatBRL(summary.crediario)}</strong>
              </div>
              {summary.other > 0 ? (
                <div>
                  <span>Outros descontos</span>
                  <strong className="is-wine">− {formatBRL(summary.other)}</strong>
                </div>
              ) : null}
              <div className="summary-rows__total">
                <span>Total descontado</span>
                <strong className="is-wine">− {formatBRL(summary.deductionsTotal)}</strong>
              </div>
            </div>

            {summary.net < 0 ? (
              <div className="form-error">Os descontos superam o salário bruto.</div>
            ) : null}

            <div className="salary-receive">
              <Field label="Conta de recebimento" htmlFor="salary-account">
                <Select
                  id="salary-account"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  {accounts.length === 0 ? <option value="">Nenhuma conta</option> : null}
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                className="btn--block"
                onClick={receive}
                disabled={summary.gross <= 0 || !accountId || dirty}
              >
                {salaryTx ? 'Atualizar recebimento' : 'Registrar recebimento'}
              </Button>
              {dirty ? (
                <p className="panel__sub panel__sub--center">
                  Salve as alterações do salário antes de registrar o recebimento.
                </p>
              ) : salaryTx ? (
                <p className="panel__sub panel__sub--center">
                  Registrado em {formatDateFull(salaryTx.date)} ·{' '}
                  {formatDateShort(salaryTx.date)}
                </p>
              ) : (
                <p className="panel__sub panel__sub--center">
                  Cria uma entrada de {formatBRL(summary.net)} na conta escolhida.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="panel">
        <div className="panel__head">
          <div>
            <p className="eyebrow">Histórico</p>
            <h2 className="panel__title">Recebimentos registrados</h2>
          </div>
        </div>
        {history.length > 0 ? (
          <div className="salary-history">
            {history.map((entry) => (
              <div className="salary-history__row" key={entry.id}>
                <span className="salary-history__month">
                  {entry.salary_month ? monthLabel(entry.salary_month) : entry.description}
                </span>
                <span className="salary-history__account">{entry.account_name ?? '—'}</span>
                <span className="salary-history__date">{formatDateShort(entry.date)}</span>
                <strong className="is-gold">{formatBRL(entry.amount)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Landmark}
            title="Nenhum recebimento registrado"
            description="Ao registrar o salário do mês, ele entra no histórico e nas entradas do painel."
          />
        )}
      </section>

      <DeductionModal
        open={deductionOpen}
        onClose={() => {
          setDeductionOpen(false);
          setEditingDeduction(null);
        }}
        deduction={editingDeduction}
      />

      <ConfirmDialog
        open={Boolean(deletingDeduction)}
        title="Excluir desconto"
        description="O desconto deixa de entrar no cálculo do salário líquido."
        onClose={() => setDeletingDeduction(null)}
        onConfirm={() => {
          if (!deletingDeduction) return;
          deleteDeduction(db, deletingDeduction.id);
          bump();
          toast('Desconto excluído.', 'info');
          setDeletingDeduction(null);
        }}
      />
    </div>
  );
}
