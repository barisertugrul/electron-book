// Categories.jsx — Adding, renaming, recoloring and deleting categories.

import { useState } from 'react';

import Icon from '../components/Icon.jsx';
import { TYPE_LABELS } from '../../shared/labels.js';
import { api } from '../api.js';

export default function Categories({ categories, refresh, notify }) {
  // Runs an action; if it succeeds, refreshes the list, otherwise shows the error.
  async function run(action) {
    try {
      await action();
      refresh();
      return true;
    } catch (error) {
      notify({ kind: 'error', text: error.message });
      return false;
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Kategoriler</h1>
      </header>
      <div className="category-columns">
        {['expense', 'income'].map((type) => (
          <section key={type} className="panel">
            <h2>{TYPE_LABELS[type]} kategorileri</h2>
            <ul className="category-list">
              {categories
                .filter((category) => category.type === type)
                .map((category) => (
                  <CategoryRow key={category.id} category={category} run={run} />
                ))}
            </ul>
            <NewCategory type={type} run={run} />
          </section>
        ))}
      </div>
    </>
  );
}

function CategoryRow({ category, run }) {
  const [name, setName] = useState(category.name);

  // When leaving the name box (or pressing Enter), save if it changed.
  function saveName() {
    if (name.trim() === category.name) return;
    run(() => api.updateCategory(category.id, { name, color: category.color })).then((ok) => {
      if (!ok) setName(category.name); // If it couldn't be saved, bring the old name back
    });
  }

  return (
    <li>
      <input
        type="color"
        value={category.color}
        aria-label="Renk"
        onChange={(event) => run(() => api.updateCategory(category.id, { name: category.name, color: event.target.value }))}
      />
      <input
        className="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={saveName}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      />
      <span className="muted usage">{category.usage} transactions</span>
      <button
        type="button"
        className="icon"
        title={category.usage > 0 ? 'A category with transactions cannot be deleted' : 'Delete'}
        disabled={category.usage > 0}
        onClick={() => run(() => api.deleteCategory(category.id))}
      >
        <Icon name="delete" />
      </button>
    </li>
  );
}

function NewCategory({ type, run }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#5b8def');

  async function add(event) {
    event.preventDefault();
    if (await run(() => api.addCategory({ name, type, color }))) setName('');
  }

  return (
    <form className="new-category" onSubmit={add}>
      <input type="color" value={color} aria-label="Renk" onChange={(event) => setColor(event.target.value)} />
      <input className="name" value={name} placeholder="New category name" onChange={(event) => setName(event.target.value)} />
      <button type="submit" disabled={!name.trim()}>
        Add
      </button>
    </form>
  );
}
