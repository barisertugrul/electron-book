// MonthlyChart.jsx — Income and expense bars for the 12 months of a year.
//
// We draw it with SVG, without a chart library: two rectangles per month.
// Clicking a month selects it.

import { formatMoney, monthName } from '../../shared/money.js';

const WIDTH = 720;
const HEIGHT = 190;
const PAD = { top: 10, right: 8, bottom: 24, left: 64 };
const BAR = 13;

// Rounds the largest value up: 18,430 -> 20,000. That way the grid lines
// land on round numbers.
function niceMax(value) {
  if (value <= 0) return 100;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((factor) => factor * power >= value);
  return step * power;
}

export default function MonthlyChart({ totals, selected, onSelect }) {
  const max = niceMax(Math.max(...totals.flatMap((row) => [row.income, row.expense])));
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = (WIDTH - PAD.left - PAD.right) / totals.length;
  const y = (value) => PAD.top + plotHeight - (value / max) * plotHeight;

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Monthly income and expenses">
      {[0.25, 0.5, 0.75, 1].map((part) => (
        <g key={part}>
          <line className="grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(max * part)} y2={y(max * part)} />
          <text className="axis" x={PAD.left - 10} y={y(max * part) + 4} textAnchor="end">
            {formatMoney(max * part, { whole: true })}
          </text>
        </g>
      ))}
      {totals.map((row, index) => {
        const x = PAD.left + index * slot;
        const center = x + slot / 2;
        return (
          <g key={row.month} className="month" onClick={() => onSelect(row.month)}>
            <rect className={row.month === selected ? 'slot selected' : 'slot'} x={x + 2} y={PAD.top} width={slot - 4} height={plotHeight} rx="6" />
            <rect className="bar income" x={center - BAR - 1} y={y(row.income)} width={BAR} height={y(0) - y(row.income)} rx="3" />
            <rect className="bar expense" x={center + 1} y={y(row.expense)} width={BAR} height={y(0) - y(row.expense)} rx="3" />
            <text className="axis" x={center} y={HEIGHT - 8} textAnchor="middle">
              {monthName(row.month, 'short')}
            </text>
            <title>{`${monthName(row.month)}\nIncome: ${formatMoney(row.income)}\nExpenses: ${formatMoney(row.expense)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
