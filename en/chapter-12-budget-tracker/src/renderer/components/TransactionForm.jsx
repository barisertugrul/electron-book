// TransactionForm.jsx — The form for adding a new transaction and editing one.
//
// A "controlled form": each field's value lives in React state, and the box
// only shows that value. As the user types, onChange updates the state.

import { useEffect, useRef, useState } from 'react';

import { formatAmount, parseAmount, today } from '../../shared/money.js';
import { api } from '../api.js';

export default function TransactionForm({ transaction, categories, onClose, onSaved }) {
  const isEdit = Boolean(transaction.id);
  const dialogRef = useRef(null);
  const [form, setForm] = useState({
    type: transaction.type ?? 'expense',
    amount: transaction.amount ? formatAmount(transaction.amount) : '',
    date: transaction.date ?? today(),
    categoryId: transaction.categoryId ?? '',
    note: transaction.note ?? '',
  });
  const [error, setError] = useState(null);

  // Open the <dialog> element as a modal. When it closes with Esc, onClose is called.
  useEffect(() => {
    dialogRef.current.showModal();
  }, []);

  // Categories that match the chosen type. When the type changes, the selection may become invalid.
  const options = categories.filter((category) => category.type === form.type);
  const categoryId = options.some((c) => c.id === Number(form.categoryId)) ? Number(form.categoryId) : '';

  // Updates a single field and leaves the others as they are (spread, JS Cornerstone 12).
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    const amount = parseAmount(form.amount);
    if (!amount) return setError('Type the amount like 1250.50.');
    if (!categoryId) return setError('Choose a category.');

    const data = { type: form.type, amount, date: form.date, categoryId, note: form.note };
    try {
      if (isEdit) await api.updateTransaction(transaction.id, data);
      else await api.addTransaction(data);
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <dialog ref={dialogRef} className="form-dialog" onClose={onClose}>
      <form onSubmit={submit}>
        <h2>{isEdit ? 'Edit transaction' : 'New transaction'}</h2>

        <div className="segmented" role="radiogroup">
          {[
            ['expense', 'Expense'],
            ['income', 'Income'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={form.type === value}
              className={form.type === value ? `on ${value}` : ''}
              onClick={() => setForm({ ...form, type: value })}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="form-row">
          <label>
            Amount
            <input value={form.amount} onChange={update('amount')} inputMode="decimal" placeholder="0.00" autoFocus />
          </label>
          <label>
            Date
            <input type="date" value={form.date} onChange={update('date')} required />
          </label>
        </div>

        <label>
          Category
          <select value={categoryId} onChange={update('categoryId')}>
            <option value="">Choose…</option>
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Note
          <input value={form.note} onChange={update('note')} maxLength={200} placeholder="Optional" />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" onClick={() => dialogRef.current.close()}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
