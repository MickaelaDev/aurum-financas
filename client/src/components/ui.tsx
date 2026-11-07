import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  type LucideIcon,
} from 'lucide-react';
import { currentMonthKey, monthLabel, shiftMonth } from '../lib/date';
import { formatAmountInput } from '../lib/money';

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
  tone?: 'default' | 'danger';
};

export function IconButton({
  label,
  icon,
  tone = 'default',
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn ${tone === 'danger' ? 'icon-btn--danger' : ''} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...rest}
    >
      {icon}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`field ${className}`.trim()}>
      <div className="field__head">
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <span className="field__hint">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="field__error">{error}</p> : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input className={`input ${className}`.trim()} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props;
  return (
    <div className="select-wrap">
      <select className={`input select ${className}`.trim()} {...rest}>
        {children}
      </select>
    </div>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return <textarea className={`input textarea ${className}`.trim()} {...rest} />;
}

export function CurrencyInput({
  value,
  onChange,
  id,
  placeholder = '0,00',
  disabled,
  autoFocus,
}: {
  value: number;
  onChange: (cents: number) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState(() => (value > 0 ? String(value) : ''));

  useEffect(() => {
    const current = Number(digits || 0);
    if (value !== current) {
      setDigits(value > 0 ? String(value) : '');
    }
  }, [value, digits]);

  return (
    <div className={`currency-input ${disabled ? 'is-disabled' : ''}`.trim()}>
      <span className="currency-input__prefix">R$</span>
      <input
        id={id}
        className="input input--currency"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={digits ? formatAmountInput(Number(digits)) : ''}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '').slice(0, 12);
          setDigits(next);
          onChange(Number(next || 0));
        }}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'is-on' : ''}`.trim()}
      onClick={onChange}
    >
      <span />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => panelRef.current?.focus(), 30);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-root">
      <div className="modal-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="modal__head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 className="modal__title">{title}</h2>
          </div>
          <IconButton label="Fechar" icon={<X size={18} />} onClick={onClose} />
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Excluir',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="confirm">
        <AlertTriangle size={20} aria-hidden="true" />
        <p>{description}</p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                       */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head__text">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-head__description">{description}</p> : null}
      </div>
      {actions ? <div className="page-head__actions">{actions}</div> : null}
    </header>
  );
}

export function MonthSwitcher({
  value,
  onChange,
}: {
  value: string;
  onChange: (month: string) => void;
}) {
  const current = currentMonthKey();
  return (
    <div className="month-switcher">
      <IconButton
        label="Mês anterior"
        icon={<ChevronLeft size={16} />}
        onClick={() => onChange(shiftMonth(value, -1))}
      />
      <span className="month-switcher__label">{monthLabel(value)}</span>
      <IconButton
        label="Próximo mês"
        icon={<ChevronRight size={16} />}
        onClick={() => onChange(shiftMonth(value, 1))}
      />
      {value !== current ? (
        <button type="button" className="month-switcher__today" onClick={() => onChange(current)}>
          Hoje
        </button>
      ) : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'gold',
}: {
  value: number;
  tone?: 'gold' | 'wine' | 'muted';
}) {
  return (
    <div className={`progress progress--${tone}`}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon size={22} strokeWidth={1.3} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} aria-hidden="true" />;
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'gold' | 'wine' | 'olive';
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export const SWATCHES = [
  '#c9a86a',
  '#b8a07a',
  '#8a8f6a',
  '#9b5f55',
  '#b98a5e',
  '#a06c7a',
  '#6b7a86',
  '#8f7f6a',
  '#7a8a7f',
  '#6b655c',
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="swatches">
      {SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch ${value === color ? 'is-selected' : ''}`.trim()}
          style={{ background: color }}
          aria-label={`Cor ${color}`}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

type ToastTone = 'success' | 'error' | 'info';
type ToastItem = { id: string; message: string; tone: ToastTone };

const ToastContext = createContext<{
  toast: (message: string, tone?: ToastTone) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<number[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = crypto.randomUUID();
    setItems((current) => [...current, { id, message, tone }]);
    const timer = window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4200);
    timers.current.push(timer);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone}`}>
            <span className="toast__mark" />
            <p>{item.message}</p>
            <button
              type="button"
              className="toast__close"
              aria-label="Fechar aviso"
              onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de ToastProvider.');
  return context;
}
