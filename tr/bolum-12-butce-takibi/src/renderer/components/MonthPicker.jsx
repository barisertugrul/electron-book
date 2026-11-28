// MonthPicker.jsx — "‹ Kasım 2026 ›" biçiminde ay seçici.

import { monthName, shiftMonth } from '../../shared/money.js';

export default function MonthPicker({ month, onChange }) {
  return (
    <div className="month-picker">
      <button type="button" className="icon" aria-label="Önceki ay" onClick={() => onChange(shiftMonth(month, -1))}>
        ‹
      </button>
      <span className="month-name">{monthName(month)}</span>
      <button type="button" className="icon" aria-label="Sonraki ay" onClick={() => onChange(shiftMonth(month, 1))}>
        ›
      </button>
    </div>
  );
}
