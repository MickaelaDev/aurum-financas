import { useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Database,
  Download,
  HardDrive,
  KeyRound,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { relativeTime } from '../lib/date';
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

export function Settings() {
  const { db, version, bump, user, savedAt, online, logout, downloadBackup, importBackup } =
    useApp();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function handleImport(file: File | undefined) {
    if (!file) return;
    try {
      const count = await importBackup(file);
      toast(`${count} ${count === 1 ? 'registro importado' : 'registros importados'}.`);
    } catch (importError) {
      toast(
        importError instanceof Error ? importError.message : 'Não foi possível importar.',
        'error',
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

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
              <p>Seus dados vivem apenas neste navegador.</p>
            </div>
          </div>
          <p className="settings-note">
            O nome identifica seu cofre. O PIN não é armazenado — ele deriva a chave
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
              <p className="eyebrow">Armazenamento</p>
              <h2 className="panel__title">Cópia local</h2>
            </div>
            <span className="panel__icon">
              <HardDrive size={17} strokeWidth={1.3} />
            </span>
          </div>
          <div className="settings-status">
            <div>
              <span className="sync-dot sync-dot--idle" />
              <strong>{savedAt ? 'Salvo neste navegador' : 'Pronto'}</strong>
            </div>
            <span className="is-muted">
              {savedAt ? `Última gravação ${relativeTime(savedAt)}` : 'Nenhuma gravação ainda'}
            </span>
          </div>
          <div className="settings-rows">
            <div>
              <span>Armazenamento</span>
              <strong>IndexedDB (cifrado)</strong>
            </div>
            <div>
              <span>Conexão</span>
              <strong className={online ? 'is-gold' : 'is-wine'}>
                {online ? 'Online' : 'Offline'}
              </strong>
            </div>
            <div>
              <span>Outros aparelhos</span>
              <strong>Backup em JSON</strong>
            </div>
          </div>
          <p className="settings-note">
            Este site é estático: não existe servidor nem sincronização automática. Para usar
            os dados em outro navegador ou aparelho, exporte o backup em JSON e importe lá.
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
            Exporte um backup completo em JSON ou importe um arquivo exportado aqui mesmo.
            O arquivo é legível e contém valores financeiros — guarde-o em local seguro.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />
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
            <Button
              variant="ghost"
              icon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Importar backup
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
                Dados locais cifrados com <strong>AES-256-GCM</strong>, com chave
                derivada do PIN via PBKDF2.
              </span>
            </li>
            <li>
              <KeyRound size={15} />
              <span>
                Nada é enviado para servidores: o cofre nunca sai deste navegador.
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
