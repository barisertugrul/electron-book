// CategoryBars.jsx — How expenses split across categories, with horizontal bars.

import { formatMoney } from '../../shared/money.js';

export default function CategoryBars({ items }) {
  const total = items.reduce((sum, item) => sum + item.total, 0);
  if (total === 0) return <p className="muted">No expenses this month.</p>;

  return (
    <ul className="category-bars">
      {items.map((item) => {
        const percent = Math.round((item.total / total) * 100);
        return (
          <li key={item.id}>
            <div className="bar-label">
              <span>
                <span className="dot" style={{ background: item.color }} />
                {item.name}
              </span>
              <span className="muted">
                {formatMoney(item.total)} · {percent}%
              </span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${percent}%`, background: item.color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
