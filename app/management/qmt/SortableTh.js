'use client';

// Sortable table header used by the master jobs table.
export default function SortableTh({ children, onClick, active, dir, align = 'left' }) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-3 py-2 font-medium text-${align === 'right' ? 'right' : 'left'} hover:text-pm-text ${
        active ? 'text-pm-orange' : ''
      }`}
    >
      {children} {active ? (dir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );
}
