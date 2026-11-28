// App.jsx — Uygulamanın kök bileşeni.
//
// Hangi sayfanın açık olduğunu, seçili ayı ve açık formu burada tutarız;
// alt bileşenler bunları props olarak alır. Veritabanında bir şey değişince
// "version" sayısını bir artırırız: ona bağlı bütün veriler yeniden yüklenir.

import { useState } from 'react';

import { api } from './api.js';
import Report from './components/Report.jsx';
import Sidebar from './components/Sidebar.jsx';
import TransactionForm from './components/TransactionForm.jsx';
import Categories from './pages/Categories.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ReportPage from './pages/ReportPage.jsx';
import Transactions from './pages/Transactions.jsx';
import { monthOf, today } from '../shared/money.js';
import { useData } from './useData.js';

const PAGES = { dashboard: Dashboard, transactions: Transactions, categories: Categories, report: ReportPage };

export default function App() {
  // PDF için açılan gizli pencerenin adresi "#/report/2026-11" ile biter.
  // O pencerede yalnızca raporu çizeriz.
  const printMonth = window.location.hash.match(/^#\/report\/(\d{4}-\d{2})$/)?.[1];
  if (printMonth) {
    return (
      <div className="print-root">
        <Report month={printMonth} onReady={() => api.reportReady()} />
      </div>
    );
  }

  return <MainWindow />;
}

function MainWindow() {
  const [page, setPage] = useState('dashboard');
  const [month, setMonth] = useState(monthOf(today()));
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(null); // null: form kapalı
  const [notice, setNotice] = useState(null); // Alttaki bilgi şeridi

  const refresh = () => setVersion((current) => current + 1);
  const { data: categories } = useData(() => api.listCategories(), [version]);

  const Page = PAGES[page];
  const shared = {
    month,
    setMonth,
    version,
    refresh,
    categories: categories ?? [],
    notify: setNotice,
    onNew: () => setEditing({}),
    onEdit: (transaction) => setEditing(transaction),
  };

  return (
    <div className="app">
      <Sidebar page={page} onChange={setPage} onNew={shared.onNew} />
      <main className="content">
        <Page {...shared} />
      </main>

      {editing && (
        <TransactionForm
          transaction={editing}
          categories={shared.categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {notice && (
        <div className={`notice ${notice.kind ?? ''}`} role="status">
          <span>{notice.text}</span>
          {notice.details && (
            <ul>
              {notice.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {notice.showFile && (
            <button type="button" className="link" onClick={() => api.showLastFile()}>
              Klasörde göster
            </button>
          )}
          <button type="button" className="icon" aria-label="Kapat" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
