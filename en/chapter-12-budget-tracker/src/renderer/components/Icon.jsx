// Icon.jsx — Small line icons (SVG). We draw them ourselves instead of using
// emoji, so they don't depend on the font.

const PATHS = {
  dashboard: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z',
  transactions: 'M4 6h16M4 12h16M4 18h10',
  categories: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 3.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0',
  report: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  delete: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  plus: 'M12 5v14M5 12h14',
};

export default function Icon({ name }) {
  return (
    <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
