import { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Cloud,
  Database,
  Download,
  KeyRound,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { formatDateTime, relativeTime } from '../lib/date';
import { listCategories, setCategoryArchived } from '../lib/repo';
import type { Category } from '../lib/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  Dot,
  IconButton,
  PageHeader,
  useToast,
} from '../components/ui';
import { CategoryModal } from '../components/CategoryModal';

const SYNC_LABEL: Record<string, string> = {
  idle: 'Tudo sincronizado',
  syncing: 'Sincronizando agora',
  offline: 'Sem conexão',
  error: 'Falha na sincronização',
  auth: 'Sessão expirada',
};

export function Settings() {
  const {
    db,
    version,
    bump,
    user,
    sync,
    online,
    logout,
    syncNow,
    resync,
    downloadBackup,
  } = useApp();
  const { toast } = useToast();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [resyncOpen, setResyncOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const categories = useMemo(() => listCategories(db, true), [db, version]);
  const income = categories.filter((category) => category.kind === 'income');
  const expense = categories.filter((category) => category.kind === 'expense');

  function openNewCategory() {
    setEditingCategory(null);
    setCategoryOpen(true);
  }

  function toggleArchive(category: Category) {
    setCategoryArchived(db, category, category.archived === 0);
    bump();
    toast(category.archived === 0 ? 'Categoria arquivada.' : 'Categoria reativada.', 'info');
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Preferências"
        title="Configurações"
        description="Sua conta, sincronização, categorias e a segurança do cofre."
      />

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Conta</p>
              <h2 className="panel__title">Seu cofre</h2>
            </div>
            <Badge tone="gold">Local-first</Badge>
          </div>
          <div className="account-identity">
            <span className="account-identity__avatar">
              {(user?.username ?? 'A').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user?.username}</strong>
              <p>
                {online ? 'Conectado ao servidor de sincronização.' : 'Trabalhando apenas com a cópia local.'}
              </p>
            </div>
          </div>
          <p className="settings-note">
            O nome identifica seu cofre. O PIN não é armazenado em texto — ele deriva a chave
            que abre os dados neste navegador.
          </p>
          <div className="settings-actions">
            <Button
              variant="secondary"
              icon={<LogOut size={14} />}
              onClick={() => setLogoutOpen(true)}
            >
              Sair e bloquear
            </Button>
          </div>
        </section>

        <section className="panel settings-card">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Sincronização</p>
              <h2 className="panel__title">Entre navegadores</h2>
            </div>
            <span className={`panel__icon ${online ? '' : 'is-muted'}`.trim()}>
              {online ? <Cloud size={17} strokeWidth={1.3} /> : <WifiOff size={17} strokeWidth={1.3} />}
            </span>
          </div>
          <div className="settings-status">
            <div>
              <span className={`sync-dot sync-dot--${sync.status}`} />
              <strong>{SYNC_LABEL[sync.status]}</strong>
            </div>
            <span className="is-muted">
              {sync.lastSyncAt ? `Última vez ${relativeTime(sync.lastSyncAt)}` : 'Ainda não sincronizado'}
            </span>
          </div>
          <div className="settings-rows">
            <div>
              <span>Alterações pendentes</span>
              <strong>{sync.pending}</strong>
            </div>
            <div>
              <span>Conexão</span>
              <strong className={online ? 'is-gold' : 'is-wine'}>
                {online ? (
                  <>
                    <Wifi size={13} /> Online
                  </>
                ) : (
                  <>
                    <WifiOff size={13} /> Offline
                  </>
                )}
              </strong>
            </div>
            <div>
              <span>Última sincronização</span>
              <strong>{sync.lastSyncAt ? formatDateTime(sync.lastSyncAt) : '—'}</strong>
            </div>
          </div>
          <div className="settings-actions">
            <Button
              variant="secondary"
              icon={<RefreshCw size={14} />}
              onClick={() => {
                void syncNow();
                toast('Sincronização solicitada.', 'info');
              }}
              disabled={!online}
            >
              Sincronizar agora
            </Button>
            <Button variant="ghost" onClick={() => setResyncOpen(true)} disabled={!online}>
              Reenviar cofre inteiro
            </Button>
          </div>
          <p className="settings-note">
            Cada navegador mantém uma cópia local. As alterações são enviadas cifradas e
            aplicadas nos outros navegadores pelo nome do cofre.
          </p>
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <div>
            <p className="eyebrow">Organização</p>
            <h2 className="panel__title">Categorias</h2>
            <p className="panel__sub">Use poucas categorias. Clareza vence detalhe excessivo.</p>
          </div>
          <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={openNewCategory}>
            Nova categoria
          </Button>
        </div>

        <div className="category-groups">
          <div>
            <p className="category-groups__label">Receitas</p>
            {income.map((category) => (
              <div
                className={`category-row ${category.archived ? 'is-inactive' : ''}`.trim()}
                key={category.id}
              >
                <span className="category-row__name">
                  <Dot color={category.color} />
                  {category.name}
                  {category.archived ? <Badge>Arquivada</Badge> : null}
                </span>
                <span className="category-row__actions">
                  <IconButton
                    label="Editar categoria"
                    icon={<Pencil size={14} />}
                    onClick={() => {
                      setEditingCategory(category);
                      setCategoryOpen(true);
                    }}
                  />
                  <IconButton
                    label={category.archived ? 'Reativar categoria' : 'Arquivar categoria'}
                    icon={
                      category.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />
                    }
                    onClick={() => toggleArchive(category)}
                  />
                </span>
              </div>
            ))}
          </div>

          <div>
            <p className="category-groups__label">Despesas</p>
            {expense.map((category) => (
              <div
                className={`category-row ${category.archived ? 'is-inactive' : ''}`.trim()}
                key={category.id}
              >
                <span className="category-row__name">
                  <Dot color={category.color} />
                  {category.name}
                  {category.archived ? <Badge>Arquivada</Badge> : null}
                </span>
                <span className="category-row__actions">
                  <IconButton
                    label="Editar categoria"
                    icon={<Pencil size={14} />}
                    onClick={() => {
                      setEditingCategory(category);
                      setCategoryOpen(true);
                    }}
                  />
                  <IconButton
                    label={category.archived ? 'Reativar categoria' : 'Arquivar categoria'}
                    icon={
                      category.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />
                    }
                    onClick={() => toggleArchive(category)}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Portabilidade</p>
              <h2 className="panel__title">Seus dados</h2>
            </div>
            <span className="panel__icon">
              <Database size={17} strokeWidth={1.3} />
            </span>
          </div>
          <p className="settings-note">
            Exporte um backup completo em JSON. O arquivo é legível e contém valores
            financeiros — guarde-o em local seguro.
          </p>
          <div className="settings-actions">
            <Button
              variant="secondary"
              icon={<Download size={14} />}
              onClick={() => {
                downloadBackup();
                toast('Backup exportado.');
              }}
            >
              Baixar backup
            </Button>
          </div>
        </section>

        <section className="panel settings-card">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Privacidade</p>
              <h2 className="panel__title">Como o cofre é protegido</h2>
            </div>
            <span className="panel__icon">
              <ShieldCheck size={17} strokeWidth={1.3} />
            </span>
          </div>
          <ul className="security-list">
            <li>
              <ShieldCheck size={15} />
              <span>
                Dados locais e sincronizados com <strong>AES-256-GCM</strong>, com chave
                derivada do PIN via PBKDF2.
              </span>
            </li>
            <li>
              <KeyRound size={15} />
              <span>
                O servidor recebe apenas registros cifrados. Nome, identificadores e datas de
                atualização são metadados.
              </span>
            </li>
            <li>
              <LockKeyhole size={15} />
              <span>
                Não existe recuperação de PIN. Se você esquecê-lo, o conteúdo do cofre não pode
                ser aberto.
              </span>
            </li>
          </ul>
        </section>
      </div>

      <p className="settings-version">Aurum · finanças pessoais · versão 1.0.0</p>

      <CategoryModal
        open={categoryOpen}
        onClose={() => {
          setCategoryOpen(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
      />

      <ConfirmDialog
        open={resyncOpen}
        title="Reenviar cofre inteiro"
        description="Todos os registros locais serão marcados como novos e enviados ao servidor. Use isso se algo parecer fora de sincronia."
        confirmLabel="Reenviar"
        onClose={() => setResyncOpen(false)}
        onConfirm={() => {
          void resync();
          toast('Reenvio completo iniciado.', 'info');
        }}
      />

      <ConfirmDialog
        open={logoutOpen}
        title="Sair do cofre"
        description="Você voltará para a tela de acesso. A cópia local permanece salva e protegida pelo PIN."
        confirmLabel="Sair"
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void logout()}
      />
    </div>
  );
}
