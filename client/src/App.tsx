import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './state/AppContext';
import { ToastProvider } from './components/ui';
import { AuthScreen } from './components/AuthScreen';
import { AppLayout } from './components/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Accounts } from './pages/Accounts';
import { Budgets } from './pages/Budgets';
import { Goals } from './pages/Goals';
import { Recurring } from './pages/Recurring';
import { Salary } from './pages/Salary';
import { Settings } from './pages/Settings';

function AppRoutes() {
  const { phase } = useApp();

  if (phase !== 'ready') {
    return <AuthScreen />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="transacoes" element={<Transactions />} />
        <Route path="contas" element={<Accounts />} />
        <Route path="orcamentos" element={<Budgets />} />
        <Route path="metas" element={<Goals />} />
        <Route path="recorrentes" element={<Recurring />} />
        <Route path="salario" element={<Salary />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AppProvider>
  );
}
