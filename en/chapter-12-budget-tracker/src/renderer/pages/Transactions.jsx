// Transactions.jsx — All transactions: filters, the list, CSV export and import.

import { useState } from 'react';

import MonthPicker from '../components/MonthPicker.jsx';
import TransactionTable from '../components/TransactionTable.jsx';
import { formatMoney } from '../../shared/money.js';
import { api } from '../api.js';
import { useData } from '../useData.js';

export default function Transactions({ month, setMonth, version, refresh, categories, notify, onNew, onEdit }) {
  const [allMonths, setAllMonths] = useState(false);
  const [type, setType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');

  // The filter sent to the main process. We don't send empty fields.
  const filter = {
    month: allMonths ? undefined : month,
    type: type || undefined,
    categoryId: categoryId ? Number(categoryId) : undefined,
    search: search.trim() || undefined,
  };
  const { data: transactions, error } = useData(
    () => api.listTransactions(filter),
    [month, allMonths, type, categoryId, search, version],
  );

  // Income and expense totals of the list (JS Cornerstone 9: reduce).
  const totals = (transactions ?? []).reduce(
    (sum, t) => ({ ...sum, [t.type]: sum[t.type] + t.amount }),
    { income: 0, expense: 0 },
  );

  async function remove(transaction) {
    try {
      const { deleted } = await api.deleteTransaction(transaction.id);
      if (deleted) refresh();
    } catch (removeError) {
      notify({ kind: 'error', text: removeError.message });
    }
  }

  async function exportCsv() {
    try {
      const result = await api.exportCsv(filter);
      if (!result.canceled) notify({ text: `${result.count} transactions written to the CSV file.`, showFile: true });
    } catch (exportError) {
      notify({ kind: 'error', text: exportError.message });
    }
  }

  async function importCsv() {
    try {
      const result = await api.importCsv();
      if (result.canceled) return;
      if (result.errors) {
        notify({ kind: 'error', text: 'The file was not imported. Fix these lines:', details: result.errors.slice(0, 5) });
        return;
      }
      const extra = result.createdCategories ? ` (${result.createdCategories} new categories)` : '';
      notify({ text: `${result.added} transactions added${extra}.` });
      refresh();
    } catch (importError) {
      notify({ kind: 'error', text: importError.message });
    }
  }

  // If a type is selected, show only the categories of that type.
  const categoryOptions = categories.filter((category) => !type || category.type === type);

  return (
    <>
      <header className="page-header">
        <h1>Transactions</h1>
        <div className="header-actions">
          <button type="button" onClick={importCsv}>
            Import CSV
          </button>
          <button type="button" onClick={exportCsv}>
            Export CSV
          </button>
          <button type="button" className="primary" onClick={onNew}>
            New transaction
          </button>
        </div>
      </header>

      <div className="filters">
        {allMonths ? <span className="month-name">All months</span> : <MonthPicker month={month} onChange={setMonth} />}
        <label className="check">
          <input type="checkbox" checked={allMonths} onChange={(event) => setAllMonths(event.target.checked)} />
          All months
        </label>
        <select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setCategoryId('');
          }}
        >
          <option value="">Income and expenses</option>
          <option value="income">Income only</option>
          <option value="expense">Expenses only</option>
        </select>
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">All categories</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input type="search" placeholder="Search notes…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {error && <p className="form-error">{error}</p>}
      <section className="panel table-panel">
        {transactions && <TransactionTable transactions={transactions} onEdit={onEdit} onDelete={remove} />}
      </section>

      {transactions && (
        <footer className="list-footer">
          <span>{transactions.length} transactions</span>
          <span className="income">Income {formatMoney(totals.income)}</span>
          <span className="expense">Expenses {formatMoney(totals.expense)}</span>
        </footer>
      )}
    </>
  );
}
