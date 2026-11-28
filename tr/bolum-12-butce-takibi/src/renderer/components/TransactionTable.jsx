// TransactionTable.jsx — İşlem listesi. Panelde kısa, İşlemler sayfasında
// düzenleme ve silme düğmeleriyle tam hâliyle kullanılır.

import { formatDate, formatMoney } from '../../shared/money.js';
import Icon from './Icon.jsx';

export default function TransactionTable({ transactions, onEdit, onDelete }) {
  if (transactions.length === 0) return <p className="muted empty">Gösterilecek işlem yok.</p>;
  const actions = Boolean(onEdit || onDelete);

  return (
    <table className="transactions">
      <thead>
        <tr>
          <th>Tarih</th>
          <th>Kategori</th>
          <th>Not</th>
          <th className="amount">Tutar</th>
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
                <button type="button" className="icon" title="Düzenle" onClick={() => onEdit(t)}>
                  <Icon name="edit" />
                </button>
                <button type="button" className="icon" title="Sil" onClick={() => onDelete(t)}>
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
