// Transactions.jsx — Bütün işlemler: filtreler, liste, CSV dışa ve içe aktarma.

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

  // Ana sürece gönderilecek filtre. Boş alanları göndermiyoruz.
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

  // Listedeki gelir ve gider toplamı (KT9: reduce).
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
      if (!result.canceled) notify({ text: `${result.count} işlem CSV dosyasına yazıldı.`, showFile: true });
    } catch (exportError) {
      notify({ kind: 'error', text: exportError.message });
    }
  }

  async function importCsv() {
    try {
      const result = await api.importCsv();
      if (result.canceled) return;
      if (result.errors) {
        notify({ kind: 'error', text: 'Dosya içe aktarılmadı. Şu satırları düzeltin:', details: result.errors.slice(0, 5) });
        return;
      }
      const extra = result.createdCategories ? ` (${result.createdCategories} yeni kategori)` : '';
      notify({ text: `${result.added} işlem eklendi${extra}.` });
      refresh();
    } catch (importError) {
      notify({ kind: 'error', text: importError.message });
    }
  }

  // Tür seçilmişse yalnızca o türün kategorilerini göster.
  const categoryOptions = categories.filter((category) => !type || category.type === type);

  return (
    <>
      <header className="page-header">
        <h1>İşlemler</h1>
        <div className="header-actions">
          <button type="button" onClick={importCsv}>
            CSV içe aktar
          </button>
          <button type="button" onClick={exportCsv}>
            CSV dışa aktar
          </button>
          <button type="button" className="primary" onClick={onNew}>
            Yeni işlem
          </button>
        </div>
      </header>

      <div className="filters">
        {allMonths ? <span className="month-name">Tüm aylar</span> : <MonthPicker month={month} onChange={setMonth} />}
        <label className="check">
          <input type="checkbox" checked={allMonths} onChange={(event) => setAllMonths(event.target.checked)} />
          Tüm aylar
        </label>
        <select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setCategoryId('');
          }}
        >
          <option value="">Gelir ve gider</option>
          <option value="income">Yalnız gelir</option>
          <option value="expense">Yalnız gider</option>
        </select>
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Bütün kategoriler</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input type="search" placeholder="Notta ara…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {error && <p className="form-error">{error}</p>}
      <section className="panel table-panel">
        {transactions && <TransactionTable transactions={transactions} onEdit={onEdit} onDelete={remove} />}
      </section>

      {transactions && (
        <footer className="list-footer">
          <span>{transactions.length} işlem</span>
          <span className="income">Gelir {formatMoney(totals.income)}</span>
          <span className="expense">Gider {formatMoney(totals.expense)}</span>
        </footer>
      )}
    </>
  );
}
