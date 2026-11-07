import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  RefreshCw,
  Repeat,
  Settings,
  Target,
  Wallet,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { relativeTime } from '../lib/date';
import { Brand } from './Brand';
import { IconButton } from './ui';

type NavItem = { to: string; label: string; icon: LucideIcon };

const GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Visão geral',
    items: [{ to: '/', label: 'Painel', icon: LayoutDashboard }],
  },
  {
    label: 'Movimentações',
    items: [
      { to: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
      { to: '/contas', label: 'Contas', icon: Wallet },
    ],
  },
  {
    label: 'Planejamento',
    items: [
      { to: '/orcamentos', label: 'Orçamentos', icon: PieChart },
      { to: '/metas', label: 'Metas', icon: Target },
      { to: '/recorrentes', label: 'Recorrentes', icon: Repeat },
    ],
  },
  {
    label: 'Renda',
    items: [{ to: '/salario', label: 'Salário', icon: Landmark }],
  },
];

const STATUS_LABEL: Record<string, string> = {
  idle: 'Sincronizado',
  syncing: 'Sincronizando',
  offline: 'Offline',
  error: 'Falha ao sincronizar',
  auth: 'Sessão expirada',
};

export function AppLayout() {
  const { user, sync, online, logout, syncNow } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
    return () => document.body.classList.remove('menu-open');
  }, [menuOpen]);

  const initials = (user?.username ?? 'A').slice(0, 1).toUpperCase();
  const syncDetail =
    sync.status === 'idle'
      ? sync.lastSyncAt
        ? `Sincronizado ${relativeTime(sync.lastSyncAt)}`
        : 'Pronto para sincronizar'
      : sync.message ?? STATUS_LABEL[sync.status];

  return (
    <div className="shell">
      <header className="mobile-top">
        <Brand compact tagline={false} />
        <IconButton
          label="Abrir menu"
          icon={<Menu size={20} />}
          onClick={() => setMenuOpen(true)}
        />
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`.trim()}>
        <div className="sidebar__head">
          <Brand />
          <IconButton
            label="Fechar menu"
            icon={<X size={18} />}
            className="sidebar__close"
            onClick={() => setMenuOpen(false)}
          />
        </div>

        <nav className="sidebar__nav">
          {GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-group__label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`.trim()}
                >
                  <item.icon size={17} strokeWidth={1.3} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <NavLink to="/configuracoes" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`.trim()}>
            <Settings size={17} strokeWidth={1.3} />
            <span>Configurações</span>
          </NavLink>

          <div className="user-box">
            <span className="user-box__avatar">{initials}</span>
            <div className="user-box__info">
              <span className="user-box__name">{user?.username}</span>
              <span className={`sync-text sync-text--${sync.status}`}>
                <span className={`sync-dot sync-dot--${sync.status}`} />
                {syncDetail}
              </span>
            </div>
            <IconButton label="Sair" icon={<LogOut size={16} />} onClick={() => void logout()} />
          </div>
        </div>
      </aside>

      <main className="main">
        {!online ? (
          <div className="ribbon ribbon--muted">
            <WifiOff size={15} />
            <span>Você está offline. Suas alterações ficam salvas neste navegador.</span>
          </div>
        ) : null}

        {online && sync.status === 'auth' ? (
          <div className="ribbon ribbon--alert">
            <span>Sua sessão expirou. Entre novamente para voltar a sincronizar.</span>
            <button type="button" onClick={() => void logout()}>
              Entrar novamente
            </button>
          </div>
        ) : null}

        {online && sync.status === 'error' ? (
          <div className="ribbon ribbon--alert">
            <span>{sync.message ?? 'Não foi possível sincronizar.'}</span>
            <button type="button" onClick={() => void syncNow()}>
              <RefreshCw size={13} /> Tentar novamente
            </button>
          </div>
        ) : null}

        <Outlet />
      </main>
    </div>
  );
}
