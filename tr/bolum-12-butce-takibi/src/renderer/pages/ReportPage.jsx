// ReportPage.jsx — Raporun önizlemesi ve "PDF olarak kaydet" düğmesi.

import { useState } from 'react';

import MonthPicker from '../components/MonthPicker.jsx';
import Report from '../components/Report.jsx';
import { api } from '../api.js';

export default function ReportPage({ month, setMonth, version, notify }) {
  const [saving, setSaving] = useState(false);

  async function savePdf() {
    setSaving(true);
    try {
      const result = await api.savePdf(month);
      if (!result.canceled) notify({ text: 'Rapor PDF olarak kaydedildi.', showFile: true });
    } catch (saveError) {
      notify({ kind: 'error', text: saveError.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Rapor</h1>
        <div className="header-actions">
          <MonthPicker month={month} onChange={setMonth} />
          <button type="button" className="primary" onClick={savePdf} disabled={saving}>
            {saving ? 'Hazırlanıyor…' : 'PDF olarak kaydet'}
          </button>
        </div>
      </header>
      <div className="paper">
        <Report month={month} version={version} />
      </div>
    </>
  );
}
