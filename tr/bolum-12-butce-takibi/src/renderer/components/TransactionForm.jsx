// TransactionForm.jsx — Yeni işlem ekleme ve var olanı düzenleme formu.
//
// "Kontrollü form": her alanın değeri React durumunda (state) durur, kutu
// yalnızca o değeri gösterir. Kullanıcı yazdıkça onChange durumu günceller.

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

  // <dialog> öğesini modal olarak aç. Esc ile kapanınca onClose çağrılır.
  useEffect(() => {
    dialogRef.current.showModal();
  }, []);

  // Seçilen türe uyan kategoriler. Tür değişince seçim de geçersizleşebilir.
  const options = categories.filter((category) => category.type === form.type);
  const categoryId = options.some((c) => c.id === Number(form.categoryId)) ? Number(form.categoryId) : '';

  // Tek bir alanı günceller, diğerlerini olduğu gibi bırakır (spread, KT12).
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    const amount = parseAmount(form.amount);
    if (!amount) return setError('Tutarı 1250,50 gibi yazın.');
    if (!categoryId) return setError('Bir kategori seçin.');

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
        <h2>{isEdit ? 'İşlemi düzenle' : 'Yeni işlem'}</h2>

        <div className="segmented" role="radiogroup">
          {[
            ['expense', 'Gider'],
            ['income', 'Gelir'],
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
            Tutar
            <input value={form.amount} onChange={update('amount')} inputMode="decimal" placeholder="0,00" autoFocus />
          </label>
          <label>
            Tarih
            <input type="date" value={form.date} onChange={update('date')} required />
          </label>
        </div>

        <label>
          Kategori
          <select value={categoryId} onChange={update('categoryId')}>
            <option value="">Seçin…</option>
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Not
          <input value={form.note} onChange={update('note')} maxLength={200} placeholder="İsteğe bağlı" />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" onClick={() => dialogRef.current.close()}>
            Vazgeç
          </button>
          <button type="submit" className="primary">
            Kaydet
          </button>
        </div>
      </form>
    </dialog>
  );
}
