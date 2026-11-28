// Sidebar.jsx — The navigation bar on the left.

import Icon from './Icon.jsx';

const ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'categories', label: 'Categories' },
  { id: 'report', label: 'Report' },
];

export default function Sidebar({ page, onChange, onNew }) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">$</span>
        Budget Tracker
      </div>
      <button type="button" className="primary new-button" onClick={onNew}>
        <Icon name="plus" />
        New transaction
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
