// App.jsx — The root component of the app.
//
// We keep the open page, the selected month and the open form here; child
// components get them as props. When something changes in the database, we
// increase the "version" number by one: all data that depends on it reloads.

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
  // The address of the hidden window opened for the PDF ends with
  // "#/report/2026-11". In that window we only draw the report.
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
  const [editing, setEditing] = useState(null); // null: the form is closed
  const [notice, setNotice] = useState(null); // The notice bar at the bottom

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
              Show in folder
            </button>
          )}
          <button type="button" className="icon" aria-label="Close" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
