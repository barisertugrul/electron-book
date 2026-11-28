// TransactionTable.jsx — The transaction list. Short on the dashboard, and
// complete with edit and delete buttons on the Transactions page.

import { formatDate, formatMoney } from '../../shared/money.js';
import Icon from './Icon.jsx';

export default function TransactionTable({ transactions, onEdit, onDelete }) {
  if (transactions.length === 0) return <p className="muted empty">No transactions to show.</p>;
  const actions = Boolean(onEdit || onDelete);

  return (
    <table className="transactions">
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Note</th>
          <th className="amount">Amount</th>
          {actions && <th className="actions" />}
        </tr>
      </thead>
      <tbody>
        {transactions.map((t) => (
          <tr key={t.id}>
            <td className="date">{formatDate(t.date)}</td>
            <td>
              <span className="chip">
                <span className="dot" style={{ background: t.categoryColor }} />
                {t.categoryName}
              </span>
            </td>
            <td className="note">{t.note}</td>
            <td className={`amount ${t.type}`}>
              {t.type === 'expense' ? '−' : '+'}
              {formatMoney(t.amount)}
            </td>
            {actions && (
              <td className="actions">
                <button type="button" className="icon" title="Edit" onClick={() => onEdit(t)}>
                  <Icon name="edit" />
                </button>
                <button type="button" className="icon" title="Delete" onClick={() => onDelete(t)}>
                  <Icon name="delete" />
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
