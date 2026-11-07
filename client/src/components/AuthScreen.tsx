import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, WifiOff } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Brand } from './Brand';
import { Button, Field, Input } from './ui';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const { phase, error, clearError, unlock, register, lastUsername, online } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState(lastUsername);
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const loading = phase === 'loading';
  const message = localError ?? error;

  function switchMode(next: Mode) {
    setMode(next);
    setPin('');
    setConfirmation('');
    setLocalError(null);
    clearError();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    clearError();

    const name = username.trim();
    if (name.length < 2) {
      setLocalError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setLocalError('O PIN deve ter de 4 a 6 dígitos.');
      return;
    }
    if (mode === 'register' && pin !== confirmation) {
      setLocalError('Os PINs não coincidem.');
      return;
    }

    if (mode === 'register') {
      await register(name, pin);
    } else {
      await unlock(name, pin);
    }
  }

  return (
    <div className="auth">
      <aside className="auth__brand">
        <Brand />
        <div className="auth__statement">
          <p className="eyebrow">Finanças pessoais</p>
          <h1>
            O seu dinheiro,
            <br />
            <em>com clareza.</em>
          </h1>
          <p className="auth__lede">
            Um painel reservado para entender o que entra, o que sai e o que sobra.
            Sem ruído, sem excesso.
          </p>
        </div>
        <div className="auth__notes">
          <span className="auth__rule" />
          <p>
            Seu cofre é criptografado com o seu PIN antes de sair deste navegador.
            Nem o servidor consegue ler seus valores.
          </p>
        </div>
      </aside>

      <main className="auth__panel">
        <div className="auth__card">
          <p className="eyebrow">{mode === 'login' ? 'Acesso ao cofre' : 'Novo cofre'}</p>
          <h2>{mode === 'login' ? 'Bem-vindo de volta' : 'Comece agora'}</h2>
          <p className="auth__copy">
            {mode === 'login'
              ? 'Entre com o nome do seu cofre e o PIN de acesso.'
              : 'Escolha um nome e um PIN. Eles serão sua única chave.'}
          </p>

          {!online ? (
            <div className="notice notice--muted">
              <WifiOff size={15} />
              <span>Sem conexão. O acesso offline usa a cópia já salva neste navegador.</span>
            </div>
          ) : null}

          <form className="auth__form" onSubmit={handleSubmit}>
            <Field label="Nome do cofre" htmlFor="auth-username">
              <Input
                id="auth-username"
                value={username}
                onChange={(event) => setUsername(event.target.value.slice(0, 24))}
                placeholder="Como você quer ser chamado"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus={!username}
              />
            </Field>

            <Field
              label="PIN"
              hint={mode === 'register' ? '4 a 6 dígitos' : undefined}
              htmlFor="auth-pin"
            >
              <div className="input-affix">
                <Input
                  id="auth-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="input--pin"
                  autoFocus={Boolean(username)}
                />
                <button
                  type="button"
                  className="input-affix__button"
                  aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                  onClick={() => setShowPin((current) => !current)}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {mode === 'register' ? (
              <Field label="Confirme o PIN" htmlFor="auth-pin-confirm">
                <Input
                  id="auth-pin-confirm"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) =>
                    setConfirmation(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="••••••"
                  className="input--pin"
                />
              </Field>
            ) : null}

            {message ? <div className="form-error">{message}</div> : null}

            <Button type="submit" loading={loading} className="btn--block">
              {mode === 'login' ? 'Abrir cofre' : 'Criar cofre'}
            </Button>
          </form>

          {mode === 'register' ? (
            <p className="auth__warning">
              Guarde bem o PIN. Ele é a única chave do cofre e não há recuperação.
            </p>
          ) : null}

          <div className="auth__switch">
            <span>
              {mode === 'login' ? 'Ainda não tem um cofre?' : 'Já tem um cofre?'}
            </span>
            <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Criar agora' : 'Entrar'}
            </button>
          </div>

          <p className="auth__fineprint">
            <LockKeyhole size={13} /> Dados salvos localmente e sincronizados de forma cifrada.
          </p>
        </div>
      </main>
    </div>
  );
}
