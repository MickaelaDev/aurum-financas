import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Wallet } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { formatBRL } from '../lib/money';
import { listAccounts, setAccountArchived, totalBalance } from '../lib/repo';
import type { Account } from '../lib/types';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  useToast,
} from '../components/ui';
import { AccountModal } from '../components/AccountModal';

const TYPE_LABEL: Record<Account['type'], string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro',
  investment: 'Investimento',
  other: 'Outra',
};

export function Accounts() {
  const { db, version, bump } = useApp();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const accounts = useMemo(() => listAccounts(db, true), [db, version]);
  const balance = useMemo(() => totalBalance(db), [db, version]);
  const active = accounts.filter((account) => account.archived === 0);
  const archived = accounts.filter((account) => account.archived === 1);
  const initialTotal = active.reduce((sum, account) => sum + account.initial_balance, 0);
  const movements = active.reduce((sum, account) => sum + account.movements, 0);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setModalOpen(true);
  }

  function toggleArchive(account: Account) {
    const next = account.archived === 0;
    setAccountArchived(db, account, next);
    bump();
    toast(next ? 'Conta arquivada.' : 'Conta reativada.', 'info');
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Patrimônio"
        title="Contas"
        description="Onde o seu dinheiro está agora, somando saldos iniciais e movimentações."
        actions={
          <Button icon={<Plus size={15} />} onClick={openNew}>
            Nova conta
          </Button>
        }
      />

      <section className="panel account-summary">
        <div>
          <p className="eyebrow">Saldo total</p>
          <p className="hero-value hero-value--ink">{formatBRL(balance)}</p>
          <p className="panel__sub">
            {active.length === 1 ? '1 conta ativa' : `${active.length} contas ativas`}
          </p>
        </div>
        <div className="account-summary__stats">
          <div>
            <span>Saldo inicial somado</span>
            <strong>{formatBRL(initialTotal)}</strong>
          </div>
          <div>
            <span>Movimentações</span>
            <strong>{movements}</strong>
          </div>
          <div>
            <span>Arquivadas</span>
            <strong>{archived.length}</strong>
          </div>
        </div>
      </section>

      {active.length > 0 ? (
        <section className="account-grid">
          {active.map((account) => (
            <article className="panel account-card" key={account.id}>
              <span className="account-card__stripe" style={{ background: account.color }} />
              <div className="account-card__head">
                <div>
                  <p className="eyebrow">{TYPE_LABEL[account.type]}</p>
                  <h2>{account.name}</h2>
                </div>
                <IconButton
                  label="Editar conta"
                  icon={<Pencil size={15} />}
                  onClick={() => openEdit(account)}
                />
              </div>
              <p className={`account-card__balance ${account.balance < 0 ? 'is-wine' : ''}`}>
                {formatBRL(account.balance)}
              </p>
              <div className="account-card__meta">
                <span>
                  Inicial <strong>{formatBRL(account.initial_balance)}</strong>
                </span>
                <span>
                  {account.movements} {account.movements === 1 ? 'movimento' : 'movimentos'}
                </span>
              </div>
              <div className="account-card__foot">
                <button type="button" className="text-link" onClick={() => toggleArchive(account)}>
                  <Archive size={13} /> Arquivar
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel">
          <EmptyState
            icon={Wallet}
            title="Nenhuma conta ativa"
            description="Crie uma conta para começar a registrar entradas e saídas."
            action={
              <Button size="sm" onClick={openNew}>
                Criar conta
              </Button>
            }
          />
        </section>
      )}

      {archived.length > 0 ? (
        <section className="archived-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Fora do total</p>
              <h2 className="panel__title">Contas arquivadas</h2>
            </div>
            <Badge>{archived.length}</Badge>
          </div>
          <div className="account-grid">
            {archived.map((account) => (
              <article className="panel account-card account-card--archived" key={account.id}>
                <div className="account-card__head">
                  <div>
                    <p className="eyebrow">{TYPE_LABEL[account.type]}</p>
                    <h2>{account.name}</h2>
                  </div>
                  <Badge>Arquivada</Badge>
                </div>
                <p className="account-card__balance">{formatBRL(account.balance)}</p>
                <div className="account-card__foot">
                  <button type="button" className="text-link" onClick={() => toggleArchive(account)}>
                    <ArchiveRestore size={13} /> Reativar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <AccountModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        account={editing}
      />
    </div>
  );
}
