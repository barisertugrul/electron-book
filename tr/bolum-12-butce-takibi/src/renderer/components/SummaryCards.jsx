// SummaryCards.jsx — Ayın gelir, gider ve kalan tutarı.

import { formatMoney } from '../../shared/money.js';

export default function SummaryCards({ summary }) {
  const cards = [
    { label: 'Gelir', value: summary.income, className: 'income' },
    { label: 'Gider', value: summary.expense, className: 'expense' },
    { label: 'Kalan', value: summary.balance, className: summary.balance < 0 ? 'expense' : '' },
  ];
  return (
    <div className="cards">
      {cards.map((card) => (
        <div key={card.label} className="card">
          <span className="card-label">{card.label}</span>
          <strong className={`card-value ${card.className}`}>{formatMoney(card.value)}</strong>
        </div>
      ))}
    </div>
  );
}
