import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SearchableSelect({ label, value, onChange, options, placeholder = 'Search', error, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={rootRef} className="relative">
      {label && <span className="label">{label}</span>}
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        className="field flex items-center justify-between text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>{selected?.label || placeholder}</span>
        <ChevronDown size={18} className="text-slate-400" />
      </button>
      {open && (
        <div id={listId} className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <input className="w-full border-b border-slate-100 px-3 py-2 text-sm outline-none" placeholder="Type to filter" value={query} onChange={(event) => setQuery(event.target.value)} />
          <ul className="max-h-56 overflow-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No matches</li>}
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-teal-50"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </div>
  );
}
