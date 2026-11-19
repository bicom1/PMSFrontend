import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

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
    <div ref={rootRef} className="relative min-w-0">
      {label && <span className="label">{label}</span>}
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        className="field flex items-center justify-between gap-2 text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>{selected?.label || placeholder}</span>
        <ChevronDown size={18} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-ink-950/40 sm:hidden" aria-label="Close list" onClick={() => setOpen(false)} />
          <div id={listId} className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:right-0 sm:z-30 sm:mt-1 sm:max-h-72 sm:rounded-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:hidden">
              <p className="min-w-0 truncate text-base font-bold text-ink-900">{label || placeholder}</p>
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <input className="w-full border-b border-slate-100 px-3 py-3 text-base outline-none" placeholder="Type to filter" value={query} onChange={(event) => setQuery(event.target.value)} />
            <ul className="min-h-0 flex-1 overflow-auto py-1">
              {filtered.length === 0 && <li className="px-3 py-3 text-base text-slate-400">No matches</li>}
              {filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className="w-full break-words px-3 py-3 text-left text-base hover:bg-teal-50"
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
        </>
      )}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </div>
  );
}
