// SummaryCards.jsx — The month's income, expense and balance.

import { formatMoney } from '../../shared/money.js';

export default function SummaryCards({ summary }) {
  const cards = [
    { label: 'Income', value: summary.income, className: 'income' },
    { label: 'Expenses', value: summary.expense, className: 'expense' },
    { label: 'Balance', value: summary.balance, className: summary.balance < 0 ? 'expense' : '' },
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
