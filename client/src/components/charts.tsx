import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { compactBRL, formatBRL } from '../lib/money';

export type CashflowPoint = {
  label: string;
  income: number;
  expense: number;
};

type ChartEntry = {
  dataKey?: string | number;
  value?: number | string;
  name?: string | number;
  payload?: { color?: string; name?: string; value?: number };
};

function CashTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartEntry[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const income = Number(payload.find((entry) => entry.dataKey === 'income')?.value ?? 0);
  const expense = Number(payload.find((entry) => entry.dataKey === 'expense')?.value ?? 0);
  const net = income - expense;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      <div className="chart-tooltip__row">
        <span>Entradas</span>
        <strong className="is-gold">{formatBRL(income)}</strong>
      </div>
      <div className="chart-tooltip__row">
        <span>Saídas</span>
        <strong className="is-wine">{formatBRL(expense)}</strong>
      </div>
      <div className="chart-tooltip__row chart-tooltip__row--net">
        <span>Saldo</span>
        <strong>{formatBRL(net)}</strong>
      </div>
    </div>
  );
}

export function CashflowChart({ data, height = 270 }: { data: CashflowPoint[]; height?: number }) {
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke="rgba(201, 168, 106, 0.10)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            tick={{ fill: 'var(--ink-faint)', fontSize: 10.5 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={58}
            tick={{ fill: 'var(--ink-faint)', fontSize: 10 }}
            tickFormatter={(value: number) => compactBRL(value)}
          />
          <Tooltip
            content={<CashTooltip />}
            cursor={{ fill: 'rgba(201, 168, 106, 0.045)' }}
          />
          <Bar dataKey="income" name="Entradas" fill="#c9a86a" radius={[2, 2, 0, 0]} maxBarSize={26} />
          <Bar dataKey="expense" name="Saídas" fill="#8f554c" radius={[2, 2, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type DonutSlice = { name: string; value: number; color: string };

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: ChartEntry[];
  total: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const value = Number(entry.value ?? 0);
  const share = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{entry.name}</p>
      <div className="chart-tooltip__row">
        <span>{share}% do total</span>
        <strong>{formatBRL(value)}</strong>
      </div>
    </div>
  );
}

export function DonutChart({
  data,
  total,
  centerLabel = 'Gasto no mês',
  height = 224,
}: {
  data: DonutSlice[];
  total: number;
  centerLabel?: string;
  height?: number;
}) {
  return (
    <div className="donut" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="68%"
            outerRadius="88%"
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip total={total} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut__center">
        <span>{centerLabel}</span>
        <strong>{formatBRL(total)}</strong>
      </div>
    </div>
  );
}

export function ChartLegend({ data }: { data: DonutSlice[] }) {
  return (
    <div className="chart-legend">
      {data.map((slice) => (
        <div className="chart-legend__item" key={slice.name}>
          <span className="dot" style={{ background: slice.color }} />
          <span className="chart-legend__name">{slice.name}</span>
          <strong>{formatBRL(slice.value)}</strong>
        </div>
      ))}
    </div>
  );
}
