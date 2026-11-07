const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function fromISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function monthKeyOf(iso: string): string {
  return (iso || '').slice(0, 7);
}

export function addMonths(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function shiftMonth(key: string, delta: number): string {
  return addMonths(key, delta);
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const name = MONTHS_LONG[(month || 1) - 1] ?? '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

export function monthShort(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS_SHORT[(month || 1) - 1]}/${String(year).slice(2)}`;
}

export function monthShortName(key: string): string {
  const [, month] = key.split('-').map(Number);
  return MONTHS_SHORT[(month || 1) - 1] ?? '';
}

export function daysInMonth(key: string): number {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

export function clampDayToMonth(key: string, day: number): string {
  const safeDay = Math.min(Math.max(day || 1, 1), daysInMonth(key));
  return `${key}-${pad2(safeDay)}`;
}

export function monthRange(key: string): { start: string; end: string } {
  return {
    start: `${key}-01`,
    end: `${key}-${pad2(daysInMonth(key))}`,
  };
}

export function formatDateShort(iso: string): string {
  const date = fromISO(iso);
  return `${pad2(date.getDate())} ${MONTHS_SHORT[date.getMonth()]}`;
}

export function formatDateFull(iso: string): string {
  const date = fromISO(iso);
  return `${date.getDate()} de ${MONTHS_LONG[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function relativeDateLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return 'Hoje';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toISO(yesterday)) return 'Ontem';
  return formatDateShort(iso);
}

export function relativeTime(timestamp: number | null): string {
  if (!timestamp) return 'nunca';
  const diff = Date.now() - timestamp;
  if (diff < 45_000) return 'agora';
  if (diff < 3_600_000) return `há ${Math.max(1, Math.round(diff / 60_000))} min`;
  if (diff < 86_400_000) return `há ${Math.round(diff / 3_600_000)} h`;
  if (diff < 7 * 86_400_000) return `há ${Math.round(diff / 86_400_000)} d`;
  return formatDateTime(timestamp);
}

export function weekStart(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

export type RangeBucket = {
  key: string;
  label: string;
  start: string;
  end: string;
};

export function lastWeeks(count: number): RangeBucket[] {
  const buckets: RangeBucket[] = [];
  const current = weekStart(new Date());
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = new Date(current);
    start.setDate(start.getDate() - index * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startISO = toISO(start);
    const endISO = toISO(end);
    buckets.push({
      key: startISO,
      label: `${pad2(start.getDate())} ${MONTHS_SHORT[start.getMonth()]}`,
      start: startISO,
      end: endISO,
    });
  }
  return buckets;
}

export function lastMonths(count: number): RangeBucket[] {
  const buckets: RangeBucket[] = [];
  const base = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(base.getFullYear(), base.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
    const range = monthRange(key);
    buckets.push({
      key,
      label: monthShort(key),
      start: range.start,
      end: range.end,
    });
  }
  return buckets;
}

export function lastYears(count: number): RangeBucket[] {
  const buckets: RangeBucket[] = [];
  const year = new Date().getFullYear();
  for (let index = count - 1; index >= 0; index -= 1) {
    const value = year - index;
    buckets.push({
      key: String(value),
      label: String(value),
      start: `${value}-01-01`,
      end: `${value}-12-31`,
    });
  }
  return buckets;
}

export function weekdayShort(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(fromISO(iso))
    .replace('.', '');
}

export function dueLabel(day: number): string {
  return `dia ${day}`;
}
