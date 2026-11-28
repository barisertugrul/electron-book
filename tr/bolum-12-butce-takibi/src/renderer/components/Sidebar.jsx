// Sidebar.jsx — Soldaki gezinme çubuğu.

import Icon from './Icon.jsx';

const ITEMS = [
  { id: 'dashboard', label: 'Panel' },
  { id: 'transactions', label: 'İşlemler' },
  { id: 'categories', label: 'Kategoriler' },
  { id: 'report', label: 'Rapor' },
];

export default function Sidebar({ page, onChange, onNew }) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">₺</span>
        Bütçe Takibi
      </div>
      <button type="button" className="primary new-button" onClick={onNew}>
        <Icon name="plus" />
        Yeni işlem
      </button>
      <ul>
        {ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={item.id === page ? 'nav active' : 'nav'}
              onClick={() => onChange(item.id)}
            >
              <Icon name={item.id} />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
