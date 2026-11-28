// Report.jsx — Aylık rapor. Hem uygulamadaki "Rapor" sayfasında önizleme
// olarak hem de PDF için açılan gizli pencerede kullanılır.

import { useEffect } from 'react';

import { APP_NAME } from '../../shared/labels.js';
import { formatDate, formatMoney, monthName, today } from '../../shared/money.js';
import { api } from '../api.js';
import { useData } from '../useData.js';

function loadReport(month) {
  return Promise.all([api.monthSummary(month), api.listTransactions({ month })]).then(
    ([summary, transactions]) => ({ summary, transactions }),
  );
}

export default function Report({ month, version, onReady }) {
  const { data, error } = useData(() => loadReport(month), [month, version]);

  // Veri ekrana çizildikten sonra (useEffect, çizimden sonra çalışır)
  // ana sürece "hazırım" deriz; o da sayfayı PDF'e çevirir.
  useEffect(() => {
    if (data) onReady?.();
  }, [data, onReady]);

  if (error) return <p className="form-error">{error}</p>;
  if (!data) return null;

  const { summary, transactions } = data;
  const expenses = summary.byCategory.filter((item) => item.type === 'expense');
  const incomes = summary.byCategory.filter((item) => item.type === 'income');

  return (
    <article className="report">
      <header>
        <div>
          <p className="report-app">{APP_NAME}</p>
          <h1>{monthName(month)} raporu</h1>
        </div>
        <p className="muted">Hazırlanma: {formatDate(today())}</p>
      </header>

      <section className="report-totals">
        <div>
          <span>Gelir</span>
          <strong className="income">{formatMoney(summary.income)}</strong>
        </div>
        <div>
          <span>Gider</span>
          <strong className="expense">{formatMoney(summary.expense)}</strong>
        </div>
        <div>
          <span>Kalan</span>
          <strong>{formatMoney(summary.balance)}</strong>
        </div>
        <div>
          <span>İşlem sayısı</span>
          <strong>{summary.count}</strong>
        </div>
      </section>

      <div className="report-columns">
        <CategoryTable title="Giderler" items={expenses} total={summary.expense} />
        <CategoryTable title="Gelirler" items={incomes} total={summary.income} />
      </div>

      <h2>İşlemler</h2>
      <table className="report-table">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Kategori</th>
            <th>Not</th>
            <th className="amount">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td>{formatDate(t.date)}</td>
              <td>{t.categoryName}</td>
              <td>{t.note}</td>
              <td className={`amount ${t.type}`}>
                {t.type === 'expense' ? '−' : '+'}
                {formatMoney(t.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function CategoryTable({ title, items, total }) {
  return (
    <section>
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="muted">Kayıt yok.</p>
      ) : (
        <table className="report-table">
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="dot" style={{ background: item.color }} />
                  {item.name}
                </td>
                <td className="amount">{formatMoney(item.total)}</td>
                <td className="amount muted">%{Math.round((item.total / total) * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
