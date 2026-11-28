// MonthPicker.jsx — A month picker that looks like "‹ November 2026 ›".

import { monthName, shiftMonth } from '../../shared/money.js';

export default function MonthPicker({ month, onChange }) {
  return (
    <div className="month-picker">
      <button type="button" className="icon" aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>
        ‹
      </button>
      <span className="month-name">{monthName(month)}</span>
      <button type="button" className="icon" aria-label="Next month" onClick={() => onChange(shiftMonth(month, 1))}>
        ›
      </button>
    </div>
  );
}
