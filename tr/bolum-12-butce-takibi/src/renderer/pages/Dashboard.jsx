// Dashboard.jsx — Panel: ayın özeti, yıllık grafik, kategori dağılımı ve
// son işlemler.

import CategoryBars from '../components/CategoryBars.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import MonthlyChart from '../components/MonthlyChart.jsx';
import SummaryCards from '../components/SummaryCards.jsx';
import TransactionTable from '../components/TransactionTable.jsx';
import { api } from '../api.js';
import { useData } from '../useData.js';

const RECENT_COUNT = 5;

export default function Dashboard({ month, setMonth, version }) {
  const year = Number(month.slice(0, 4));
  const summary = useData(() => api.monthSummary(month), [month, version]);
  const totals = useData(() => api.yearTotals(year), [year, version]);
  const recent = useData(() => api.listTransactions({ month }), [month, version]);

  return (
    <>
      <header className="page-header">
        <h1>Panel</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      {summary.data && <SummaryCards summary={summary.data} />}

      <div className="panels">
        <section className="panel wide">
          <div className="panel-title">
            <h2>{year} yılı</h2>
            <span className="legend">
              <span className="dot income-bg" /> Gelir <span className="dot expense-bg" /> Gider
            </span>
          </div>
          {totals.data && <MonthlyChart totals={totals.data} selected={month} onSelect={setMonth} />}
        </section>

        <section className="panel">
          <h2>Giderlerin dağılımı</h2>
          {summary.data && <CategoryBars items={summary.data.byCategory.filter((item) => item.type === 'expense')} />}
        </section>

        <section className="panel">
          <h2>Son işlemler</h2>
          {recent.data && <TransactionTable transactions={recent.data.slice(0, RECENT_COUNT)} />}
          {recent.data?.length > RECENT_COUNT && (
            <p className="muted">ve {recent.data.length - RECENT_COUNT} işlem daha</p>
          )}
        </section>
      </div>
    </>
  );
}
