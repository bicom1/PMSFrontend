import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

function parseCustom(text, { kind, min, max, exclusiveMin, integer, maxLength }) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (kind !== 'number') {
    if (trimmed.length > maxLength) return { error: `Use up to ${maxLength} characters` };
    return { value: trimmed, label: trimmed };
  }
  if (integer ? !/^\d+$/.test(trimmed) : !/^\d+(\.\d+)?$/.test(trimmed)) {
    return { error: integer ? 'Enter a whole number' : 'Enter a number' };
  }
  const number = Number(trimmed);
  if (exclusiveMin != null && !(number > exclusiveMin)) return { error: `Enter a number above ${exclusiveMin}` };
  if (min != null && number < min) return { error: `Enter a number from ${min}` };
  if (max != null && number > max) return { error: `Enter a number up to ${max}` };
  return { value: String(number), label: String(number) };
}

export default function SearchableSelect({
  label, value, onChange, options, placeholder = 'Search', error, disabled,
  allowCustom = false, customKind = 'text', customMin, customMax, customExclusiveMin, customInteger = false, customMaxLength = 80, unit = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const listId = useId();
  const selected = options.find((option) => String(option.value) === String(value ?? ''));
  const hasValue = value != null && String(value) !== '';
  const buttonText = selected?.label || (hasValue ? (unit ? `${value} ${unit}` : String(value)) : placeholder);

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const typed = query.trim();
  const exact = options.find((option) => option.label.toLowerCase() === typed.toLowerCase() || String(option.value).toLowerCase() === typed.toLowerCase());
  const custom = allowCustom && typed && !exact
    ? parseCustom(typed, { kind: customKind, min: customMin, max: customMax, exclusiveMin: customExclusiveMin, integer: customInteger, maxLength: customMaxLength })
    : null;

  function commit(next) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }

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
        <span className={`min-w-0 flex-1 truncate ${hasValue ? 'text-slate-800' : 'text-slate-400'}`}>{buttonText}</span>
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
            <input
              className="w-full border-b border-slate-100 px-3 py-3 text-base outline-none"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                if (exact) commit(exact.value);
                else if (custom?.value) commit(custom.value);
              }}
            />
            <ul className="min-h-0 flex-1 overflow-auto py-1">
              {filtered.length === 0 && !custom?.value && <li className={`px-3 py-3 text-base ${custom?.error ? 'text-rose-600' : 'text-slate-400'}`}>{custom?.error || 'No matches'}</li>}
              {custom?.value && (
                <li>
                  <button type="button" className="w-full break-words px-3 py-3 text-left text-base font-bold text-teal-800 hover:bg-teal-50" onClick={() => commit(custom.value)}>
                    Use “{unit ? `${custom.label} ${unit}` : custom.label}”
                  </button>
                </li>
              )}
              {filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className="w-full break-words px-3 py-3 text-left text-base hover:bg-teal-50"
                    onClick={() => commit(option.value)}
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
